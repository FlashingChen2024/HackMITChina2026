# 🚀 Golang 后端 MVP 开发与验收计划

严格遵循 MVP 原则。**每一个 Milestone (M) 必须独立测试通过后，方可进入下一个阶段。** 测试工具统一定义为 Postman 或 Apifox。

### 🟢 M1: 基础设施打通 (Infrastructure)（已完成）

* **开发任务**:
1. 初始化 Go 模块，搭建目录结构 (如 `cmd/`, `internal/api/`, `internal/service/`, `internal/model/`)。
2. 封装 MySQL 和 Redis 的连接池初始化逻辑。
3. 利用 GORM 的 `AutoMigrate` 生成数据表结构。
4. 提供 `GET /api/v1/ping` 探活接口。


* **验收标准**:
1. 服务成功监听指定端口（如 8080）。
2. 访问 `/ping` 返回 200，且通过日志确认 MySQL 和 Redis 连接不报错。
3. 查看数据库，`meals` 和 `meal_curve_data` 表已成功建立。



### 🟢 M2: 状态机纯内存运转 (FSM in Redis)（已完成）

* **开发任务**:
1. 开发 `POST /hardware/telemetry` 路由。
2. 在 Service 层实现状态机逻辑。
3. **屏蔽数据库**：本阶段只操作 Redis（读写 `current_state`, `last_weight` 等），使用 `log.Printf` 打印本应执行的 SQL 动作。


* **验收标准 (Postman 串行测试)**:
1. 发送 $\Delta W = 2g$ 的负载，日志打印 `[死区拦截] 不执行动作`。
2. 发送 $400g$，日志打印 `[状态跃迁] IDLE -> SERVING`。
3. 发送 $390g$ (模拟过了15秒)，日志打印 `[状态跃迁] SERVING -> EATING`。
4. 发送 $0g$，日志打印 `[状态跃迁] EATING -> IDLE`。



### 🟢 M3: 数据真实落盘 (Persistence)（已完成）

* **开发任务**:
1. 将 M2 中打印的日志，替换为真实的 GORM 数据库操作。
2. 实现 `SERVING -> EATING` 时的 `INSERT` (主表)。
3. 实现 `EATING` 循环中的时序数据 `INSERT` (轨迹表)，包含防抖约束逻辑。
4. 实现 `EATING -> IDLE` 时的 `UPDATE` (主表结算)。


* **验收标准 (Postman + 数据库 GUI)**:
1. 用 Postman 完整模拟一顿饭：`0g` -> `500g` -> `450g` -> `400g` -> `0g`。
2. 查看 MySQL：`meals` 表新增刚好 1 行数据，`total_served_g` 为 500，`total_leftover_g` 为 400。
3. 查看 MySQL：`meal_curve_data` 表新增 2 行数据（对应 450g 和 400g 的时间点）。



### 🟢 M4: 基础数据读取 (Basic Query)（已完成）

* **开发任务**:
1. 实现 `GET /meals` 接口，完成基于 `cursor`（时间戳）的分页逻辑。
2. 实现 `GET /meals/{meal_id}` 接口。


* **验收标准 (Postman)**:
1. 调用列表接口，能成功返回 M3 模拟的该条记录，且携带正确的 `next_cursor`。
2. 带上 `cursor` 再次请求，返回空数组（证明游标分页生效）。
3. 调用详情接口，数据与数据库主表完全一致。



### 🟢 M5: 高阶轨迹大一统接口 (Advanced Trajectory)（已完成）

* **开发任务**:
1. 开发 `GET /meals/{meal_id}/trajectory`。
2. 实现核心判断：无 `last_timestamp` 则拉取全量；有则附加 `WHERE timestamp > ?` 条件拉取增量。
3. (可选) 实现基于 `sample_interval` 的内存均值聚合算法。


* **验收标准 (Postman)**:
1. 直接请求，返回 M3 期间存入的所有轨迹点。
2. 带上刚才返回的最后一个点的 `timestamp` 再次请求，必须返回空数组。
3. 手动在数据库里插入一个最新时间戳的数据，再次用上一步的条件请求，**必须且仅返回这 1 条新数据**。



### 🔴 M6: 健壮性与并发压测 (Stress Test & Edge Cases)

* **开发任务**:
1. 在代码中补充对“中途加饭”（`EATING -> SERVING`）逻辑的支持。
2. 增加 Redis 的并发锁机制（`SETNX` 或 Go 原生的 `sync.Mutex`），防止硬件并发重传导致的幻读。


* **验收标准**:
1. **容错验收**：模拟吃饭到一半，突然发一个 $800g$（原来峰值是 $500g$），状态机必须正确退回 `SERVING`，最终结算的打饭量必须累加。
2. **并发验收**：用工具（如 Apache ab 或 Postman Runner）在一秒内对 `telemetry` 接口并发发送 100 次相同的请求。系统不能崩溃，数据库不能出现重复记录。

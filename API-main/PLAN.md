**实施原则**：云端算力前置，专注 SQL 性能与数据结构转化。

### 🟢 M1: 聚合 SQL 逻辑构建与 GORM 适配（已完成）

* **任务**：
1. 在 `MealRepository` 层编写针对 `GET /users/me/statistics/charts` 的自定义 SQL 或 GORM `Select().Group()` 方法。
2. 实现按照 `start_date` 和 `end_date` 过滤数据。
3. 联表或聚合计算 `SUM(total_cal)`, `SUM(intake_g)`, 及推算 `AVG(speed)`。


* **验收**：通过 Go 单元测试或数据库控制台直接运行该聚合 SQL，确认按天分组的数据准确无误，且无日期遗漏或跨时区偏移。

### 🟡 M2: 控制器组装与数据结构转换（已完成）

* **任务**：
1. 在 Gin 路由树注册 `/users/me/statistics/charts` 接口，并挂载 JWT 中间件。
2. 接收 M1 返回的行级结构（Row-based），在 Controller 层通过遍历，将其**反转/拆解**为前端所需的列级并行数组结构（Column-based arrays，如 `dates`, `daily_served_g` 等）。
3. 处理空值逻辑（如果某天未就餐，应填充 `0` 而非断层）。


* **验收 (Postman)**：传入包含历史记录的日期范围，接口成功返回 200，并且 `chart_data` 内的五个数组长度完全一致，数据类型严格对应前端图表要求。

### 🔴 M3: 前后端联调与废弃旧链路

* **任务**：
1. 通知前端将 `VITE_API_BASE` 统一指向 Go 云端地址。
2. 前端彻底删除并下线 Node.js 图表聚合中间层代码。
3. 前端图表组件切换为调用 v4.1 新接口并完成数据绑定。


* **验收**：通过客户端 App 访问“统计页面”，图表秒开，折线图走势与后端数据库手工核算的聚合结果完全一致，全链路架构统一完成。

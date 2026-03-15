**实施原则**：严格分块，步步为营。跑通上一层 Postman 测试前，严禁进入下一层。

### 🟢 M1: 鉴权与物理强绑定 (Auth & Hook)（已完成）

* **任务**：
1. 建立 `users` 和 `device_bindings` 模型。
2. 实现注册/登录接口及 `JWTAuthMiddleware` 拦截器。
3. 实现设备绑定接口。修改 `/hardware/telemetry` 植入反向拦截网关。


* **验收**：未绑定设备发数据被静默丢弃；绑定后成功触发 Redis 状态机流转。

### 🟢 M2: 分格基座与状态机解耦 (Grid FSM)（已完成）

* **任务**：
1. 建立 `meal_grids` 和修改后的 `meals` 模型。
2. 大改 `fsm_engine.go`：就餐结束时，往 `meal_grids` 插入 4 行独立数据（包含打饭量和剩余量，食物名称暂空）。


* **验收**：硬件发送完一顿饭的轨迹后，数据库里成功生成该饭局的 4 个格子明细记录。

### 🟢 M3: AI 视觉参数挂载与卡路里点火 (Vision Pipeline)（已完成）

* **任务**：
1. 实现 `PUT /meals/{meal_id}/foods` 接口。
2. 执行运算：遍历传来的数组，在 `meal_grids` 找到对应 `grid_index`，更新 `food_name` 和热量，并自动算出这格的 `total_cal` = `intake_g * unit_cal_per_100g / 100`。


* **验收**：调用接口传参后，数据库中这 4 个格子的卡路里数值和菜名被完美填补。单次详情查询接口 (`GET /meals/{meal_id}`) 能返回高精度的分格数据。

### 🟢 M4: 社区聚合引擎 (The Dashboard Core)（已完成）

* **任务**：
1. 建立 `communities` 相关模型，跑通建群和加群接口。
2. 编写 `GET /communities/{community_id}/dashboard` 接口的核心 SQL 聚合逻辑：联表查询该社区所有用户的 `meal_grids`，按 `food_name` 执行 `GROUP BY`，计算 `AVG(served_g)`、`AVG(intake_g)` 等。


* **验收**：模拟 3 个用户在同一个社区里吃了几顿“西红柿炒鸡蛋”，调用看板接口，立刻得到准确的平均打饭量和进食速度。

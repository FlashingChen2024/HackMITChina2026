## 1. 核心目标

将系统的底层颗粒度从“整顿饭”下探到“每一个独立分格”。支持前端 AI 拍照识别食物挂载，实现精准卡路里计算，并落地社区大屏的全局食物均值聚合分析。

## 2. 数据库实体重构规范 (GORM Models)

系统必须建立以下 6 张核心数据表以支撑新业务：

1. **`users`**: `id` (UUID), `username`, `password_hash` (bcrypt).
2. **`device_bindings`**: `device_id` (ESP32 MAC), `user_id`.
3. **`meals`**: `meal_id`, `user_id`, `start_time`, `duration_minutes`. (注：移除了 `total_served_g`，仅保留整体会话信息)。
4. **`meal_curve_data`**: 时序表，保存每个时间点的 `grid_1` 到 `grid_4` 重量，强依赖联合索引 `(meal_id, timestamp)`。
5. **`meal_grids` (新增核心表)**: `id`, `meal_id`, `grid_index` (1-4), `food_name`, `unit_cal_per_100g`, `served_g`, `leftover_g`, `intake_g`, `total_cal`。
6. **`communities` & `user_communities` (新增社区表)**: 管理圈子与用户的多对多关系。

## 3. 核心流转逻辑“大手术”

* **网关反向映射**：`/hardware/telemetry` 收包时，必须先查询 `device_bindings`。无绑定则丢弃；有绑定则提取 `user_id` 向下透传。
* **FSM 结算解耦**：状态机从 `EATING -> IDLE` 结算时，不再计算总重量。必须读取 4 个格子的（最高峰值 - 最终值），算出各自的 `served_g` 和 `leftover_g`，并在 `meal_grids` 表中 `INSERT` 4 条初始化记录。
* **卡路里延迟计算**：前端调用 `/meals/{meal_id}/foods` 时，根据前端传来的 `unit_cal_per_100g`，结合表中已有的 `intake_g`，计算出 `total_cal` 并 `UPDATE` 回 `meal_grids` 表。

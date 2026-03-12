# 📄 K-XYZ 智能餐盒 API 服务器 - 需求文档 (PRD v2.0)

## 1. 系统定位

本系统是一个基于 Golang 开发的高并发、无状态 RESTful API 服务器。负责接收底层 ESP32 硬件的高频时序数据，通过 Redis 维护设备的有限状态机（FSM），并利用 MySQL 持久化用户的就餐聚合数据与时序轨迹。

## 2. 技术栈标准

* **Web 框架**: Gin (`gin-gonic/gin`)
* **缓存与状态管理**: Redis (使用 `redis/go-redis/v9`)
* **数据库**: MySQL 8.0+
* **ORM**: GORM (`gorm.io/gorm`)

## 3. 核心业务与状态机 (FSM) 规则

系统依托 Redis 的 Hash 结构维护 `device:{device_id}` 的当前状态。

* **死区拦截 (Deadband)**：若总重量变化 $|\Delta W| < 5g$，直接丢弃数据，不触发任何状态逻辑。
* **IDLE (待机)**：系统初始状态。若 $|\Delta W| > 50g$ 且持续增长，跃迁至 `SERVING`。
* **SERVING (备餐)**：在 Redis 中维护 `temp_peak_weight`。若重量一阶导数 $\frac{dW}{dt} \le 0$ 并持续 15 秒，生成唯一 `meal_id`，将打饭量写入 MySQL，跃迁至 `EATING`。
* **EATING (就餐)**：持续收割有效消耗点写入 MySQL 轨迹表。若出现突刺 ($W_t > W_{t-1}$)，强制单调递减 ($W_t = W_{t-1}$)。
* **就餐结束**：若绝对重量 $< 10g$，或连续 600 秒 $|\Delta W| < 1g$。计算总摄入量与时长，更新 MySQL 主表，跃迁回 `IDLE`。
* **异常回退 (中途加饭)**：在 `EATING` 态下突增 $> 50g$，状态强制打回 `SERVING`，准备追加打饭量。

## 4. 数据库实体关系 (ER) 核心要求

* **`meals` 表**: 存储 `meal_id` (主键), `user_id`, `start_time`, `duration_minutes`, `total_served_g`, `total_leftover_g`。
* **`meal_curve_data` 表**: 存储时序点。**强制要求**建立联合索引 `idx_meal_time (meal_id, timestamp)`。

## 5. 接口规范清单 (API Spec)

1. `POST /api/v1/hardware/telemetry`: 硬件数据上报（驱动 FSM）。
2. `GET /api/v1/meals`: 历史记录列表（**强制使用 `cursor` 游标分页**，废弃 limit/offset）。
3. `GET /api/v1/meals/{meal_id}`: 单次就餐统计详情（仅读取主表）。
4. `GET /api/v1/meals/{meal_id}/trajectory`: 轨迹查询（支持 `last_timestamp` 增量轮询与 `sample_interval` 动态降采样）。

---

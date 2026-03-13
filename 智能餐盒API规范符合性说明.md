# 智能餐盒核心 API 接口规范 (v1.1) 符合性说明

本文档对照《智能餐盒核心 API 接口规范 (v1.1).pdf》说明当前后端的符合情况。

**Base URL**：`/api/v1`（当前实现与规范一致）

---

## 1. 硬件遥测数据上报 (Telemetry Ingestion)

| 项目 | 规范要求 | 当前实现 | 符合 |
|------|----------|----------|------|
| 路径 | `POST /hardware/telemetry` | `POST /api/v1/hardware/telemetry` | ✅ |
| Request Body | `device_id` (string)、`timestamp` (Unix 秒)、`weights`: `{ grid_1, grid_2, grid_3, grid_4 }` (克) | 一致，缺参时返回 400 | ✅ |
| Response | 200 OK，不返回业务数据（ACK） | `res.status(200).end()` 无 body | ✅ |
| 死区 (IDLE) | \|ΔW\| < 5.0g 直接抛弃 | `DEADBAND_G: 5` | ✅ |
| IDLE→SERVING | \|ΔW\| > 50g 且时间窗 < 60s | `SERVING_DELTA_G: 50`，`SERVING_TIME_WINDOW_S: 60` | ✅ |
| SERVING→EATING | 重量一阶导数 ≤0 持续 15s | `non_increase_since` 持续 15s 判定 | ✅ |
| EATING→IDLE | 绝对重量 < 10g 或 600s 内 \|ΔW\| < 1.0g | `SETTLE_WEIGHT_G: 10`，`SETTLE_STABLE_DELTA_G: 1`，`SETTLE_STABLE_DURATION_S: 600` | ✅ |

**结论**：遥测接口与状态机逻辑**完全符合**规范。

---

## 2. 获取历史用餐记录列表 (Meal List - 游标分页)

| 项目 | 规范要求 | 当前实现 | 符合 |
|------|----------|----------|------|
| 路径 | `GET /meals` | `GET /api/v1/meals` | ✅（已实现） |
| Query | `user_id` (必填)、`cursor` (可选)、`limit` (可选，默认 20) | 一致 | ✅ |
| Response | `{ data: [ { meal_id, start_time, total_served_g } ], pagination: { next_cursor, has_more } }` | 一致，无 total 避免 COUNT 扫表 | ✅ |

**结论**：已实现，符合规范。

---

## 3. 获取单次用餐详情 (Meal Detail)

| 项目 | 规范要求 | 当前实现 | 符合 |
|------|----------|----------|------|
| 路径 | `GET /meals/{meal_id}` | `GET /api/v1/meals/:meal_id` | ✅（已实现） |
| 性能 | O(1) 主键读取，不实时计算 | 仅读 Lunchbox_Meals 表 | ✅ |
| Response | `{ meal_id, duration_minutes, total_served_g, total_leftover_g, total_intake_g }` | 一致，无则 404 | ✅ |

**结论**：已实现，符合规范。

---

## 4. 获取就餐时序轨迹 (Meal Trajectory)

| 项目 | 规范要求 | 当前实现 | 符合 |
|------|----------|----------|------|
| 路径 | `GET /meals/{meal_id}/trajectory` | `GET /api/v1/meals/:meal_id/trajectory` | ✅（已实现） |
| Query | `last_timestamp` (可选，增量游标)、`sample_interval` (可选，降采样秒) | 一致 | ✅ |
| 场景 A 全量 | 不传 `last_timestamp`，返回全量切片，可带降采样 | `query_mode: "historical"` | ✅ |
| 场景 B 增量 | 传 `last_timestamp`，返回 `timestamp > last_timestamp` 的点 | `query_mode: "incremental"` | ✅ |
| Response | `{ meal_id, query_mode, points: [ { timestamp, weights: { grid_1..4 } } ] }` | 一致 | ✅ |

**结论**：已实现，符合规范。

---

## 5. 规范外的扩展接口（设备绑定）

规范中未定义「设备与用户绑定」接口；为实现遥测上报时根据 `device_id` 解析 `user_id` 并写入 `Meal_Records`，当前项目扩展了以下接口（不影响规范接口）：

- `POST /api/v1/devices/bindings` — 绑定设备与用户  
- `GET /api/v1/devices/bindings?user_id=` — 按用户查已绑定设备  
- `GET /api/v1/devices/bindings/:device_id` — 按设备查绑定  
- `DELETE /api/v1/devices/bindings/:device_id` — 解绑  

---

## 汇总

| 规范接口 | 状态 |
|----------|------|
| POST /api/v1/hardware/telemetry | ✅ 符合 |
| GET /api/v1/meals | ✅ 符合（已实现） |
| GET /api/v1/meals/{meal_id} | ✅ 符合（已实现） |
| GET /api/v1/meals/{meal_id}/trajectory | ✅ 符合（已实现） |

当前实现已与《智能餐盒核心 API 接口规范 (v1.1)》中规定的 4 个接口对齐；设备绑定为扩展能力，供业务与遥测使用。

# K-XYZ 智能餐盒 API v4.0 变更说明

本文档说明按《K-XYZ 智能餐盒全链路 API 接口规范 (v4.0 满血版)》与会议重构方向完成的修改与删除。

---

## 一、鉴权（Global Auth）

- **新增**：`POST /api/v1/auth/register` — body `{ username, password }`，返回 `{ user_id, message }`
- **新增**：`POST /api/v1/auth/login` — body `{ username, password }`，返回 `{ token, user_id, username }`
- **规则**：除 **GET /api/v1/ping**、**POST /api/v1/hardware/telemetry**、**auth/register**、**auth/login** 外，其余接口均需在请求头携带：
  ```http
  Authorization: Bearer <JWT_Token>
  ```
- **实现**：后端使用 `jsonwebtoken` + `bcryptjs`，用户表 `Users`（迁移 008）；鉴权中间件 `requireAuth` 校验 Token 并设置 `req.user = { userId, username }`。

---

## 二、硬件遥测（v4.0）

- **请求体**：恢复为 **weights 四格**：
  ```json
  { "device_id": "string", "timestamp": "可选 RFC3339/Unix 秒", "weights": { "grid_1", "grid_2", "grid_3", "grid_4" } }
  ```
- **未绑定设备拦截**：若 `device_id` 未绑定用户，返回 **403** `{ error: "device not bound", message: "设备未绑定，请先完成设备认主" }`，不进入状态机。
- **成功响应**：200，`{ device_id, previous_state, current_state, timestamp }`。

---

## 三、设备认主（v4.0）

- **新接口**：`POST /api/v1/devices/bind`（需鉴权）
  - Body：`{ "device_id": "string" }`，**不再传 user_id**，用户从 JWT 解析。
  - 成功：200，`{ message: "device bind success", device_id }`
- **保留**：`GET /api/v1/devices/bindings` — 查询当前用户已绑定设备（鉴权后无需 query user_id）
- **保留**：`DELETE /api/v1/devices/bindings/:device_id` — 解绑（需鉴权）
- **删除**：旧 `POST /api/v1/devices/bindings` 的 body `{ device_id, user_id }` 形式（改为上述 bind）。

---

## 四、就餐数据（Meals）v4.0

- **GET /api/v1/meals**（需鉴权）
  - 按**当前用户**过滤，无需传 user_id。
  - 响应：`{ items: [ { meal_id, start_time, duration_minutes, total_meal_cal } ], next_cursor }`
- **GET /api/v1/meals/:meal_id**（需鉴权）
  - 响应增加：`total_meal_cal`、`grid_details` 数组（grid_index, food_name, served_g, leftover_g, intake_g, total_cal, speed_g_per_min）。
- **GET /api/v1/meals/:meal_id/trajectory**（需鉴权）
  - 响应：`items` 中每项为 `{ timestamp, weights: { grid_1, grid_2, grid_3, grid_4 } }`（不再使用单值 weight_g）。
- **新增**：`PUT /api/v1/meals/:meal_id/foods`（需鉴权）
  - Body：`{ grids: [ { grid_index, food_name, unit_cal_per_100g } ] }`，当前为占位实现，返回 200 与固定文案。

---

## 五、社区板块（暂缓）

- **新增占位**：`POST /api/v1/communities/create`、`POST /api/v1/communities/:id/join`、`GET /api/v1/communities/:id/dashboard`
  - 均返回 **503** `{ error: "社区板块暂缓推进" }`，待需求对齐后再实现。

---

## 六、饮食汇总/图表/报告/建议（保留并加鉴权）

- `/api/diet/summary/run`、`/api/diet/seed/meal_records`、`/api/diet/analysis/generate`、`/api/diet/analysis/report`、`/api/diet/recommendations`、`/api/diet/statistics/charts` 均改为**需鉴权**。
- 其中部分接口若未传 `user_id`，则使用 Token 中的 `userId`。

---

## 七、前端变更

- **登录/注册**：新增 `/login` 页，调用 `POST /api/v1/auth/register`、`POST /api/v1/auth/login`，登录成功后 Token 写入 localStorage。
- **请求头**：除请求 `/api/v1/auth/*` 外，所有请求自动携带 `Authorization: Bearer <token>`。
- **路由**：统计图表、AI 报告、个性化建议、设备管理 均需登录，未登录跳转 `/login`。
- **设备管理**：仅保留「设备 ID」输入与「绑定」「解绑」「查询已绑定设备」；**不再使用 user_id 输入**，用户由后端从 Token 解析。
- **导航**：标题改为「K-XYZ 智能餐盒」，增加「登录/登出」。

---

## 八、部署与迁移

- **环境变量**：在 `.env` 中增加 **JWT_SECRET**（必填，用于签发与校验 JWT）。
- **数据库**：执行 `npm run migrate`，会新增 **008_create_users.sql**（Users 表）。
- **本地端口**：规范中本地开发为 8080，可在 `.env` 中设置 `PORT=8080`；默认仍为 3000。

---

以上为本次按 v4.0 规范与会议结论完成的修改与删除摘要。

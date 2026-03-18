# K-XYZ 智能餐盒 API 与 v4.0 规范对齐说明

本文说明当前后端与《K-XYZ 智能餐盒全链路 API 接口规范 (v4.0 满血版)》的对应关系，以及**收不到数据**时的排查要点。

---

## 一、Base URL 与端口（收不到数据时先查这里）

规范约定：

- **生产**: `https://api.mit.chenyuxia.com/api/v1`
- **本地开发**: `http://127.0.0.1:8080/api/v1`

当前项目默认后端端口为 **3000**。若你按规范使用 **8080** 或生产域名，需保证「请求发往的地址」与「实际运行的后端」一致：

| 场景 | 后端 | 前端 / 调用方 |
|------|------|----------------|
| 与规范本地一致 | 在项目根 `.env` 中设 `PORT=8080`，然后 `npm start` | 前端 `.env` 或 `.env.local` 设 `VITE_API_BASE=http://127.0.0.1:8080` |
| 使用默认 3000 | 不设 PORT 或 `PORT=3000`，`npm start` | `VITE_API_BASE=http://localhost:3000` 或留空（若用 Vite proxy 指到 3000） |

**若“收不到数据”**：先确认后端已启动，且浏览器/客户端请求的 Base URL 与后端监听端口一致（例如不要前端连 8080 而后端在 3000）。

---

## 二、鉴权

- 除 **GET /ping**、**POST /hardware/telemetry**、**POST /auth/register**、**POST /auth/login** 外，其余接口均需在 Header 中携带：
  ```http
  Authorization: Bearer <JWT_Token>
  ```
- 未带或 Token 无效会返回 `401`，也会表现为“收不到正常数据”。

---

## 三、接口路径与实现状态

所有接口均挂载在 **`/api/v1`** 下，与规范一致：

| 规范路径 | 本后端实现 | 说明 |
|----------|------------|------|
| GET /ping | GET /api/v1/ping | 返回 `{ message, timestamp }` |
| POST /hardware/telemetry | POST /api/v1/hardware/telemetry | 支持 `timestamp` 为 RFC3339 或 Unix 秒；未绑定设备 403 |
| POST /auth/register | POST /api/v1/auth/register | |
| POST /auth/login | POST /api/v1/auth/login | |
| POST /devices/bind | POST /api/v1/devices/bind | user_id 从 JWT 取 |
| GET /meals | GET /api/v1/meals | 游标分页，按当前用户过滤 |
| GET /meals/{meal_id} | GET /api/v1/meals/:meal_id | 含 grid_details |
| GET /meals/{meal_id}/trajectory | GET /api/v1/meals/:meal_id/trajectory | 支持 last_timestamp、sample_interval |
| PUT /meals/{meal_id}/foods | PUT /api/v1/meals/:meal_id/foods | 占位：返回成功，暂未持久化菜品与卡路里 |
| POST /communities/create 等 | 同上路径 | 占位返回 503 |

---

## 四、响应数据为何部分为 0 或空

规范中的部分字段依赖「菜品挂载」或后续计算，当前实现如下：

- **total_meal_cal**（列表与详情）：当前固定为 `0`。规范要求通过 **PUT /meals/{meal_id}/foods** 挂载各格食物与 `unit_cal_per_100g` 后由后端计算；当前 PUT 为占位，未持久化，故卡路里未计算。
- **grid_details[].food_name / total_cal**：同上，需 PUT 持久化并参与计算后才有值；当前为占位（如 food_name 空、total_cal 0）。
- **打饭量/摄入量/剩余量**：来自遥测与结算，有数据时会在列表、详情、轨迹中正常返回。

若你希望「收到和规范一致的数据」：需要实现 PUT /meals/:id/foods 的持久化，并在 GET /meals 与 GET /meals/:id 中根据挂载结果计算并返回 total_meal_cal 与 grid_details 中的 food_name、total_cal 等。

---

## 五、快速自检（收不到数据时）

1. **健康检查**：`curl http://127.0.0.1:8080/api/v1/ping`（若后端在 3000 则改端口），应返回 `{"message":"pong","timestamp":"..."}`。
2. **鉴权接口**：用登录返回的 token：`curl -H "Authorization: Bearer <token>" http://127.0.0.1:8080/api/v1/meals`（端口同理），应返回 `{ items, next_cursor }`。
3. **前端**：确认 `VITE_API_BASE` 与后端 PORT 一致，且已登录（localStorage 有 token），再请求统计、用餐记录等页。

若以上都正常，则“收不到数据”多为：请求地址/端口错误、未带 Token 或 Token 过期、或该用户/设备下确实无数据（如未跑遥测、未做汇总等）。

# 前端所需后端 API 清单（对齐 API-main / v4.2）

本文档汇总**当前前端（`frontend/`）实际会调用**的后端接口清单，用于你在云端后端（API-main）侧实现/对齐路由与返回结构。

> 约定：以下路径均以 **Base URL** 为前缀拼接。  
> - **生产**：`https://api.mit.chenyuxia.com`  
> - **API 前缀**：`/api/v1`（即完整为 `https://api.mit.chenyuxia.com/api/v1/...`）  
>
> 重要：前端请求代码里大部分路径已带 `/api/v1`，因此 `VITE_API_BASE` 建议配置为域名根（不带 `/api/v1`），例如：  
> `VITE_API_BASE=https://api.mit.chenyuxia.com`

---

## 一、全局鉴权规范

- 除 **健康检查**、**登录/注册**、**硬件遥测**外，其余接口均需携带：

```http
Authorization: Bearer <JWT>
```

- 后端应从 JWT 中解析当前用户身份，做到**用户隔离**：
  - v4.1 图表接口明确要求：**禁止在 URL 传 `user_id`**，必须从 JWT 获取。

---

## 二、基础运维

### 1）健康检查

- **GET** `/api/v1/ping`（建议同时兼容 `/ping`，以对齐文档）
- **用途**：前端/运维验证服务是否存活
- **响应示例**：

```json
{ "message": "pong", "timestamp": "2026-03-14T09:10:37Z" }
```

---

## 三、账户与鉴权（Auth）

### 2）注册

- **POST** `/api/v1/auth/register`
- **鉴权**：无
- **用途**：前端「注册并登录」流程使用（若云端不开放注册，应在前端隐藏注册入口）
- **请求体**：

```json
{ "username": "string", "password": "string" }
```

- **响应体**（示例）：

```json
{ "user_id": "string", "message": "register success" }
```

### 3）登录

- **POST** `/api/v1/auth/login`
- **鉴权**：无
- **用途**：前端登录，拿到 JWT 后保存到 `localStorage.token`
- **请求体**：

```json
{ "username": "string", "password": "string" }
```

- **响应体**（示例）：

```json
{ "token": "string", "user_id": "string", "username": "string" }
```

> 注意：当前前端会从 JWT payload 解码展示「当前用户」。云端 JWT payload 若不是 `{ userId, username }`，建议后端额外提供一个 `GET /users/me`，或前端改为只展示 username（可选）。

---

## 四、设备管理（Device Lifecycle / v4.2）

前端页面：`/devices`。

### 4）绑定设备

- **POST** `/api/v1/devices/bind`
- **鉴权**：需要 JWT
- **用途**：将 `device_id` 绑定到当前 JWT 用户
- **请求体**：

```json
{ "device_id": "string" }
```

- **响应体**（示例）：

```json
{ "message": "device bind success", "device_id": "string" }
```

### 5）查询已绑定设备列表（v4.2）

- **GET** `/api/v1/devices`
- **鉴权**：需要 JWT
- **用途**：设备管理页「查询已绑定设备」
- **响应体**（v4.2 示例）：

```json
{
  "items": [
    { "device_id": "ESP32_A1B2C3", "bind_time": "2026-03-14T09:15:00Z", "status": "online" }
  ]
}
```

> 当前前端已按 v4.2 改为调用 `GET /api/v1/devices`，并读取 `{ items }`。

### 6）解绑设备（v4.2）

- **DELETE** `/api/v1/devices/:device_id`
- **鉴权**：需要 JWT
- **用途**：设备管理页解绑按钮
- **响应体**（v4.2 示例）：

```json
{ "message": "解绑成功，设备已重置", "device_id": "ESP32_A1B2C3" }
```

---

## 五、用餐记录（Meals）

前端页面：`/meals`（用餐记录列表）、部分页面需要单次详情与轨迹能力。

### 7）历史用餐列表（游标分页）

- **GET** `/api/v1/meals`
- **鉴权**：需要 JWT
- **查询参数**：
  - `cursor`（可选，RFC3339 或 unix seconds）
  - `limit`（可选，默认 20）
- **响应体**（示例）：

```json
{
  "items": [
    { "meal_id": "string", "start_time": "2026-03-14T09:00:00Z", "duration_minutes": 25, "total_meal_cal": 450.5 }
  ],
  "next_cursor": "2026-03-14T09:00:00Z"
}
```

### 8）单次用餐详情

- **GET** `/api/v1/meals/:meal_id`
- **鉴权**：需要 JWT
- **用途**：查看单次餐次的格子详情（served/leftover/intake/cal/speed）

### 9）就餐时序轨迹

- **GET** `/api/v1/meals/:meal_id/trajectory`
- **鉴权**：需要 JWT
- **查询参数**（可选）：
  - `last_timestamp`：增量查询基准
  - `sample_interval`：降采样间隔（秒）

### 10）菜品挂载（卡路里）

- **PUT** `/api/v1/meals/:meal_id/foods`
- **鉴权**：需要 JWT
- **用途**：将识别到的菜品信息挂到各格，后端据此计算 `total_meal_cal` 等
- **请求体**：

```json
{
  "grids": [
    { "grid_index": 1, "food_name": "糙米饭", "unit_cal_per_100g": 116.0 }
  ]
}
```

---

## 六、图表聚合（v4.1 重点）

前端页面：`/charts`。

### 11）个人图表数据聚合（禁止传 user_id）

- **GET** `/users/me/statistics/charts`
- **鉴权**：需要 JWT
- **查询参数**：
  - `start_date`：`YYYY-MM-DD`
  - `end_date`：`YYYY-MM-DD`
- **用途**：一次性拿到图表所需数组数据，前端据此派生 5 种图（日趋势/周对比/浪费/速度/营养饼图）
- **响应体**（v4.1 示例）：

```json
{
  "user_id": "string",
  "date_range": ["2026-03-01", "2026-03-14"],
  "chart_data": {
    "dates": ["03-01", "03-02"],
    "daily_served_g": [600.0, 550.0],
    "daily_intake_g": [500.0, 450.0],
    "daily_calories": [750.5, 620.0],
    "avg_speed_g_per_min": [15.2, 14.0]
  }
}
```

---

## 七、云端 AI 智能营养师（v4.2 新增）

前端页面：目前 UI 仍是 `/report`（AI 报告）与 `/recommendations`（个性化建议），但两者都已切换为调用 **统一的 AI 建议接口** `GET /users/me/ai-advice`。

### 12）AI 建议（v4.2）

- **GET** `/users/me/ai-advice`
- **鉴权**：需要 JWT（后端从 JWT 取当前用户）
- **查询参数**：
  - `type`（必填）：`meal_review` / `daily_alert` / `next_meal`
- **响应体**（v4.2 示例）：

```json
{
  "type": "meal_review",
  "advice": "吃这么快赶火车吗？炸鸡全吃光，菠菜剩大半！膳食纤维严重不足，下一顿立刻补充绿叶菜！",
  "is_alert": false
}
```

> 前端：  
> - `/report` 根据页面选择映射 `type`（`daily -> daily_alert`、`weekly -> next_meal`）并展示 `advice` 文案；  
> - `/recommendations` 默认请求 `type=next_meal` 并展示 `advice` 文案。

---

## 八、前端当前“缺口”总结（你需要后端补的）

若你希望前端页面全部可用，需要确保：

1. **设备管理（v4.2）**：`POST /devices/bind`、`GET /devices`、`DELETE /devices/{device_id}` 已在云端实现并部署  
2. **AI 功能（v4.2）**：`GET /users/me/ai-advice` 已在云端实现并部署  
3. **如果仍出现 404**：优先检查云端后端是否已实现并部署 `GET /devices` 与 `GET /users/me/ai-advice`（以及对应鉴权中间件），并确认 Base URL 与路径前缀完全一致。

> 说明：以上接口我已在本地 `API-main` 代码补齐（包含 `GET /api/v1/devices`、`DELETE /api/v1/devices/:device_id`、`GET /api/v1/users/me/ai-advice`），但**线上仍需重新部署后端服务**才能生效。

---

## 九、线上后端需要修改/补齐的内容（按“前端可用优先级”）

这一节是给你对“线上 `https://api.mit.chenyuxia.com` 到底要改什么”的**落地清单**。你只要逐条对齐实现并部署，前端对应页面就会从 `HTTP 404` 变成可用。

### 9.1 必须新增/对齐的路由（否则前端必 404）

> 前端目前实际请求路径（都带 `/api/v1` 前缀）：
> - 设备页：`GET /api/v1/devices`、`DELETE /api/v1/devices/:device_id`
> - AI 报告/建议页：`GET /api/v1/users/me/ai-advice?type=...`

#### A）设备列表（v4.2）

- **方法/路径**：`GET /api/v1/devices`
- **鉴权**：必须 Bearer Token
- **后端行为**：
  - 从 JWT 解析当前用户 `user_id`
  - 查询该用户绑定的设备列表（按 `bind_time` 倒序即可）
- **响应结构必须是**：

```json
{
  "items": [
    { "device_id": "ESP32_A1B2C3", "bind_time": "2026-03-14T09:15:00Z", "status": "online" }
  ]
}
```

> 说明：`status` 目前前端只展示 `device_id`，但仍建议按规范返回；若暂时没有真实在线状态，可先固定 `"online"` 或 `"unknown"`。

#### B）设备解绑（v4.2）

- **方法/路径**：`DELETE /api/v1/devices/:device_id`
- **鉴权**：必须 Bearer Token
- **后端行为**：
  - 从 JWT 解析当前用户 `user_id`
  - 仅允许解绑“归属当前用户”的设备
- **状态码/返回建议**：
  - **200 OK**（解绑成功）：

```json
{ "message": "解绑成功，设备已重置", "device_id": "ESP32_A1B2C3" }
```

  - **403 Forbidden**（设备属于他人）：

```json
{ "error": "无权解绑他人的设备" }
```

  - **404 Not Found**（设备不存在/未绑定）：

```json
{ "error": "device not found" }
```

#### C）AI 建议（v4.2，AI 报告/个性化建议统一入口）

- **方法/路径**：`GET /api/v1/users/me/ai-advice`
- **鉴权**：必须 Bearer Token
- **查询参数**：
  - `type`（必填）：`meal_review` / `daily_alert` / `next_meal`
- **后端行为（最小可用版本）**：
  - 从 JWT 解析当前用户 `user_id`
  - 根据 `type` 返回一段文案（哪怕先是规则占位）即可让前端不再 404
- **响应结构必须是**：

```json
{
  "type": "meal_review",
  "advice": "string",
  "is_alert": false
}
```

> 说明：你现在看到的 `/report` 页面 `HTTP 404`，本质就是线上缺少这个路由（不是前端 bug）。

---

### 9.2 JWT 鉴权“必须对齐”的点（否则会变成 401/403）

前端对鉴权的假设如下：

- 登录成功后把 `token` 保存到 `localStorage.token`
- 除 `/auth/*` 外的请求自动带：

```http
Authorization: Bearer <token>
```

后端需要保证：

- **JWT middleware** 能解析 Bearer Token，并把当前用户写入上下文（例如 `user_id`、`username`）
- **所有 “/users/me/*” 路由** 必须从 JWT 取用户身份（禁止让前端传 `user_id`）

> 可选：前端 UI 目前会“解码 JWT payload”来展示当前用户；如果你们线上 JWT payload 字段不是 `{ userId, username }`，这只影响展示，不影响接口调用（接口靠 Header）。

---

### 9.3 线上数据“150 份用餐数据不显示”的常见原因清单（非 404，但你很关心）

这类问题通常不是前端，而是**数据源不一致或用户隔离不一致**：

- **原因 1：线上用餐数据属于别的用户**
  - 图表接口与 meals 列表接口都是按 JWT 的 `user_id` 做过滤
  - 你登录的账号如果不是那 150 份数据对应的用户，就会“看不到”

- **原因 2：你们线上存的表/模型和前端读取的表/模型不是同一套**
  - 前端当前读取的是 v4.x 的 `GET /api/v1/meals`（items + next_cursor）与 `GET /api/v1/users/me/statistics/charts`
  - 如果你们 150 份数据存在旧表（例如旧 Node 后端的 `Meal_Records/Daily_Diet_Summary`），但 Go 后端读取的是新表（例如 `meals/meal_grids`），那也会“看不到”

- **原因 3：卡路里为 0（不是识别失败，是计算条件不满足）**
  - v4.0 规范里 `PUT /meals/:meal_id/foods` 只是“把菜品/单位热量挂载上去”
  - `total_cal` 的计算通常依赖 `intake_g`（摄入克数），而摄入克数来自遥测 + 结算
  - 如果 meal 没走到“结算”，或 `intake_g` 为 0，那么 `total_cal` 也会是 0

---

### 9.4 线上部署后自检（建议你用 curl 直接验证，不用看前端）

> 用任意已登录 token（`$TOKEN`）验证路由是否已上线。

- **AI advice**：

```bash
curl -sS "https://api.mit.chenyuxia.com/api/v1/users/me/ai-advice?type=meal_review" \
  -H "Authorization: Bearer $TOKEN"
```

- **设备列表**：

```bash
curl -sS "https://api.mit.chenyuxia.com/api/v1/devices" \
  -H "Authorization: Bearer $TOKEN"
```

- **设备解绑**：

```bash
curl -sS -X DELETE "https://api.mit.chenyuxia.com/api/v1/devices/ESP32_A1B2C3" \
  -H "Authorization: Bearer $TOKEN"
```

如果以上任意一个仍然是 **HTTP 404**，只有两种可能：

1) **线上后端代码没实现该路由**  
2) **实现了但没重新部署**（旧版本服务仍在跑）



# 📦 K-XYZ 智能餐盒全链路 API 接口规范（优化终版）

## Base URL

- **生产环境**: `https://api.mit.chenyuxia.com/api/v1`
  
- **本地开发**: `http://127.0.0.1:8080/api/v1`
  

---

## 🛡️ 全局鉴权规范 (Global Auth)

除 **0. 健康检查**、**1. 硬件遥测上报** 和 **2. 注册/登录** 外，其余所有业务接口均需在 HTTP Request Header 中强制携带 JWT Token：

```http
Authorization: Bearer <Your_JWT_Token>
```

---

## 🔌 0. 基础运维

### 0.1 健康检查 (Ping)

- **接口路径**: `GET /ping`
  
- **成功响应** `200 OK`:
  

```json
{
  "message": "pong",
  "timestamp": "2026-03-14T09:10:37Z"
}
```

---

## 🔌 第一部分：硬件底层网关 (IoT Gateway)

### 1.1 硬件遥测数据上报

- **接口路径**: `POST /hardware/telemetry`
  
- **鉴权**: 无 *(后端根据 device_id 执行物理拦截)*
  
- **请求体**:
  

```json
{
  "device_id": "string",
  "timestamp": "2026-03-14T09:10:00Z",
  "weights": {
    "grid_1": 150.5,
    "grid_2": 80.0,
    "grid_3": 120.0,
    "grid_4": 50.0
  }
}
```

- **成功响应** `200 OK`:

```json
{
  "device_id": "ESP32_A1B2C3",
  "previous_state": "IDLE",
  "current_state": "SERVING",
  "timestamp": "2026-03-14T09:10:05Z"
}
```

---

## 📱 第二部分：账户与设备管理 (Auth & Device Lifecycle)

### 2.1 用户注册

- **接口路径**: `POST /auth/register`
  
- **请求体**:
  

```json
{
  "username": "string",
  "password": "string"
}
```

- **成功响应** `200 OK`:

```json
{
  "user_id": "string",
  "message": "register success"
}
```

---

### 2.2 用户登录

- **接口路径**: `POST /auth/login`
  
- **请求体**:
  

```json
{
  "username": "string",
  "password": "string"
}
```

- **成功响应** `200 OK`:

```json
{
  "token": "string",
  "user_id": "string",
  "username": "string"
}
```

---

### 3.1 绑定物理餐盒

- **接口路径**: `POST /devices/bind`
  
- **请求体**:
  

```json
{
  "device_id": "string"
}
```

- **成功响应** `200 OK`:

```json
{
  "message": "device bind success",
  "device_id": "string"
}
```

---

### 3.2 查询已绑定设备列表

- **接口路径**: `GET /devices`
  
- **成功响应** `200 OK`:
  

```json
{
  "devices": [
    "ESP32_A1B2C3",
    "ESP32_D4E5F6"
  ]
}
```

---

### 3.3 解除绑定设备

- **接口路径**: `DELETE /devices/{device_id}`
  
- **成功响应** `200 OK`:
  

```json
{
  "message": "device unbind success",
  "device_id": "ESP32_A1B2C3"
}
```

---

## 🥗 第三部分：就餐数据与 AI 引擎核心 (Meal & AI)

### 4.1 菜品视觉识别与卡路里点火

- **接口路径**: `PUT /meals/{meal_id}/foods`
  
- **请求体**:
  

```json
{
  "grids": [
    {
      "grid_index": 1,
      "food_name": "糙米饭",
      "unit_cal_per_100g": 116.0
    },
    {
      "grid_index": 2,
      "food_name": "西红柿炒鸡蛋",
      "unit_cal_per_100g": 80.0
    }
  ]
}
```

- **成功响应** `200 OK`:

```json
{
  "message": "食物信息挂载成功，卡路里已就绪"
}
```

---

### 4.2 获取历史用餐列表 (分页)

- **接口路径**: `GET /meals`
  
- **成功响应** `200 OK`:
  

```json
{
  "items": [
    {
      "meal_id": "str",
      "start_time": "...",
      "duration_minutes": 25,
      "total_meal_cal": 450
    }
  ],
  "next_cursor": "..."
}
```

---

### 4.3 获取单次用餐高精详情

- **接口路径**: `GET /meals/{meal_id}`
  
- **成功响应** `200 OK`:
  

```json
{
  "meal_id": "str",
  "grid_details": [
    {
      "grid_index": 1,
      "food_name": "糙米饭",
      "served_g": 200,
      "intake_g": 150,
      "total_cal": 174,
      "speed_g_per_min": 6.0
    }
  ]
}
```

---

### 4.4 获取就餐时序轨迹（支持增量查询与降采样）

用于获取某次就餐过程中各分格重量的时序变化轨迹，支持前端按时间轴绘制折线图、回放进食过程，以及执行增量拉取与降采样展示。

- **接口路径**: `GET /meals/{meal_id}/trajectory`
  
- **查询参数**:
  
  - `last_timestamp` *(string, 可选)*  
    增量查询基准时间戳。传入上一次返回结果中的 `last_timestamp` 后，接口仅返回该时间点之后的新增轨迹数据。
    
  - `sample_interval` *(integer, 可选)*  
    降采样时间间隔，单位为秒。用于减少返回点数，便于前端图表渲染与大屏展示。
    
- **成功响应** `200 OK`:
  

```json
{
  "meal_id": "string",
  "items": [
    {
      "timestamp": "2026-03-14T09:00:01Z",
      "weights": {
        "grid_1": 195.0,
        "grid_2": 80.0,
        "grid_3": 120.0,
        "grid_4": 50.0
      }
    }
  ],
  "last_timestamp": "2026-03-14T09:00:01Z"
}
```

---

### 4.5 个人饮食图表数据聚合

- **接口路径**: `GET /users/me/statistics/charts`

- **查询参数**:
  
  - `start_date` *(string, 必填, YYYY-MM-DD)*
    
  - `end_date` *(string, 必填, YYYY-MM-DD，且 >= start_date)*
  
- **成功响应** `200 OK`:
  

```json
{
  "user_id": "string",
  "date_range": ["2026-03-12", "2026-03-19"],
  "chart_data": {
    "dates": ["03-01", "03-02"],
    "daily_served_g": [980.0, 860.0],
    "daily_intake_g": [750.0, 620.0],
    "daily_calories": [750.5, 620.0],
    "avg_speed_g_per_min": [15.2, 14.0]
  }
}
```

---

### 5.1 云端 AI 智能营养师

- **接口路径**: `GET /users/me/ai-advice`
  
- **查询参数**: `type` (`meal_review` / `daily_alert` / `next_meal`)
  
- **成功响应** `200 OK`:
  

```json
{
  "type": "meal_review",
  "advice": "吃这么快赶火车吗...",
  "is_alert": false
}
```

---

## 🌍 第四部分：社区圈子与可视化大屏 (Community)

> 本模块用于承载用户侧社区加入、社区归属管理，以及面向可视化大屏的社区级饮食聚合统计能力。

### 6.1 创建社区

- **接口路径**: `POST /communities/create`
  
- **请求体**:
  

```json
{
  "name": "string",
  "description": "string"
}
```

- **成功响应** `200 OK`:

```json
{
  "community_id": "string",
  "message": "创建成功"
}
```

---

### 6.2 加入社区

- **接口路径**: `POST /communities/{community_id}/join`
  
- **成功响应** `200 OK`:
  

```json
{
  "message": "加入成功"
}
```

---

### 6.3 获取我的社区列表

为前端“我的圈子”页提供数据源，用于渲染用户已加入的社区卡片列表。

- **接口路径**: `GET /communities`
  
- **成功响应** `200 OK`:
  

```json
{
  "items": [
    {
      "community_id": "comm_12345",
      "name": "MIT 黑客松健康营",
      "description": "一起吃得更健康",
      "member_count": 102
    }
  ]
}
```

---

### 7.1 获取社区聚合看板数据

为社区可视化大屏提供聚合结果。后端按社区维度汇总成员的菜品打饭量、摄入量与进食速度均值，供前端直接渲染排行榜、柱状图和数据总览区。

- **接口路径**: `GET /communities/{community_id}/dashboard`
  
- **成功响应** `200 OK`:
  

```json
{
  "community_id": "comm_12345",
  "community_name": "MIT 黑客松健康营",
  "member_count": 102,
  "food_avg_stats": [
    {
      "food_name": "西红柿炒鸡蛋",
      "avg_served_g": 180.5,
      "avg_intake_g": 150.5,
      "avg_speed_g_per_min": 12.5
    }
  ]
}
```

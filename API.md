# 📦 K-XYZ 智能餐盒全链路 API 接口规范 (v4.0 满血版)

### Base URL

* **生产环境**: `https://api.mit.chenyuxia.com/api/v1`
* **本地开发**: `http://127.0.0.1:8080/api/v1`

### 🛡️ 全局鉴权规范 (Global Auth)

除 **0.健康检查**、**1.硬件遥测上报** 和 **2. 注册/登录** 外，其余所有业务接口均需在 HTTP Request Header 中强制携带 JWT Token：

```http
Authorization: Bearer <Your_JWT_Token>

```

---

## 🔌 0. 基础运维

### 0.1 健康检查 (Ping)

* **接口路径**: `GET /ping`
* **成功响应** `200 OK`:
```json
{
  "message": "pong",
  "timestamp": "2026-03-14T09:10:37Z"
}

```



---

## 🔌 第一部分：硬件底层网关 (IoT Gateway)

### 1. 硬件遥测数据上报

接收底层 ESP32 硬件的高频时序数据。后端需在暗箱中根据 `device_id` 拦截未绑定设备，并将 4 个格子的物理重量分别注入 FSM 状态机进行防抖和平滑处理 。

* **接口路径**: `POST /hardware/telemetry`
* **鉴权**: 无
* **请求体**:
```json
{


# 📄 交付物一：K-XYZ 智能餐盒全链路 API 接口规范 (v4.0 满血版)

### Base URL

* **生产环境**: `https://api.mit.chenyuxia.com/api/v1`
* **本地开发**: `http://127.0.0.1:8080/api/v1`

### 🛡️ 全局鉴权规范 (Global Auth)

除 **0.健康检查**、**1.硬件遥测上报** 和 **2. 注册/登录** 外，其余所有业务接口均需在 HTTP Request Header 中强制携带 JWT Token：

```http
Authorization: Bearer <Your_JWT_Token>

```

---

## 🔌 0. 基础运维

### 0.1 健康检查 (Ping)

* **接口路径**: `GET /ping`
* **成功响应** `200 OK`: `{"message": "pong", "timestamp": "2026-03-14T09:10:37Z"}`

---

## 🔌 第一部分：硬件底层网关 (IoT Gateway)

### 1. 硬件遥测数据上报

接收底层 ESP32 硬件的高频时序数据。**后端在暗箱中根据 `device_id` 拦截未绑定设备**，并将 4 个格子的物理重量分别注入 FSM 状态机进行防抖和平滑处理。

* **接口路径**: `POST /hardware/telemetry`
* **鉴权**: 无
* **请求体**:
```json
{
  "device_id": "string (如 ESP32_A1B2C3)",
  "timestamp": "2026-03-14T09:10:00Z",
  "weights": {
    "grid_1": 150.5,
    "grid_2": 80.0,
    "grid_3": 120.0,
    "grid_4": 50.0
  }
}

```


* **成功响应** `200 OK`:
```json
{
  "device_id": "ESP32_A1B2C3",
  "previous_state": "IDLE",
  "current_state": "SERVING",
  "timestamp": "2026-03-14T09:10:05Z"
}

```



---

## 📱 第二部分：账户与设备绑定 (Auth & Binding)

### 2. 用户鉴权

#### 2.1 用户注册

* **接口路径**: `POST /auth/register`
* **请求体**: `{"username": "string", "password": "string"}`
* **成功响应** `200 OK`: `{"user_id": "string", "message": "register success"}`

#### 2.2 用户登录

* **接口路径**: `POST /auth/login`
* **请求体**: `{"username": "string", "password": "string"}`
* **成功响应** `200 OK`: `{"token": "string (JWT)", "user_id": "string", "username": "string"}`

### 3. 设备认主

#### 3.1 绑定物理餐盒

* **接口路径**: `POST /devices/bind`
* **请求体**: `{"device_id": "string (扫码获取的 ESP32 MAC)"}`
* **成功响应** `200 OK`: `{"message": "device bind success", "device_id": "string"}`

---

## 🥗 第三部分：就餐数据与 AI 卡路里核心 (Meal & Calorie)

### 4. 菜品视觉识别与挂载

前端 App 拍照识别吃的菜品后，调用此接口将食物营养学数据挂载到就餐记录的对应格子上，后端自动计算真实卡路里。

* **接口路径**: `PUT /meals/{meal_id}/foods`
* **请求体**:
```json
{
  "grids": [
    { "grid_index": 1, "food_name": "糙米饭", "unit_cal_per_100g": 116.0 },
    { "grid_index": 2, "food_name": "西红柿炒鸡蛋", "unit_cal_per_100g": 80.0 },
    { "grid_index": 3, "food_name": "清炒西兰花", "unit_cal_per_100g": 33.0 },
    { "grid_index": 4, "food_name": "紫菜汤", "unit_cal_per_100g": 15.0 }
  ]
}

```


* **成功响应** `200 OK`: `{"message": "食物信息挂载成功，卡路里已就绪"}`

### 5. 获取就餐记录与统计

#### 5.1 获取历史用餐列表 (游标分页)

* **接口路径**: `GET /meals`
* **查询参数**: `cursor` (string, 可选)
* **成功响应** `200 OK`:
```json
{
  "items": [
    {
      "meal_id": "string",
      "start_time": "2026-03-14T09:00:00Z",
      "duration_minutes": 25,
      "total_meal_cal": 450.5
    }
  ],
  "next_cursor": "2026-03-14T09:00:00Z"
}

```



#### 5.2 获取单次用餐高精详情

展示精确到每个格子的打饭量、剩余量、摄入量、卡路里和用餐速度。

* **接口路径**: `GET /meals/{meal_id}`
* **成功响应** `200 OK`:
```json
{
  "meal_id": "string",
  "start_time": "2026-03-14T09:00:00Z",
  "duration_minutes": 25,
  "total_meal_cal": 450.5,
  "grid_details": [
    {
      "grid_index": 1,
      "food_name": "糙米饭",
      "served_g": 200.0,
      "leftover_g": 50.0,
      "intake_g": 150.0,
      "total_cal": 174.0,
      "speed_g_per_min": 6.0
    }
  ]
}

```



#### 5.3 获取就餐时序轨迹 (降采样支持)

* **接口路径**: `GET /meals/{meal_id}/trajectory`
* **查询参数**: `last_timestamp` (增量查询基准), `sample_interval` (降采样秒数)
* **成功响应** `200 OK`:
```json
{
  "meal_id": "string",
  "items": [
    {
      "timestamp": "2026-03-14T09:00:01Z",
      "weights": {"grid_1": 195.0, "grid_2": 80.0, "grid_3": 120.0, "grid_4": 50.0}
    }
  ],
  "last_timestamp": "2026-03-14T09:00:01Z"
}

```



---

## 🌍 第四部分：社区圈子与可视化大屏 (Community Dashboard)

### 6. 社区基建

#### 6.1 创建社区

* **接口路径**: `POST /communities/create`
* **请求体**: `{"name": "string", "description": "string"}`
* **成功响应** `200 OK`: `{"community_id": "string", "message": "创建成功"}`

#### 6.2 加入社区

* **接口路径**: `POST /communities/{community_id}/join`
* **成功响应** `200 OK`: `{"message": "加入成功"}`

### 7. 社区大屏聚合看板 (Dashboard)

后端直出该社区所有菜品的打饭量、剩余量、摄入量和用餐速度的平均值。

* **接口路径**: `GET /communities/{community_id}/dashboard`
* **成功响应** `200 OK`:
```json
{
  "community_id": "string",
  "community_name": "MIT 黑客松健康营",
  "member_count": 102,
  "food_avg_stats": [
    {
      "food_name": "西红柿炒鸡蛋",
      "avg_served_g": 180.5,
      "avg_leftover_g": 30.0,
      "avg_intake_g": 150.5,
      "avg_speed_g_per_min": 12.5
    }
  ]
}

```

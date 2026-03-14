# 通过 API 获取与导入 Mock 数据

本文说明如何**通过接口导入** mock 数据到系统，以及如何**通过接口获取**已有数据。

---

## 一、导入 Mock 数据（三种方式）

### 方式 1：批量写入用餐记录（推荐，用于图表/日报）

直接向 `Meal_Records` 表写入多条用餐记录，再触发「每日汇总」和「生成报告」，图表和 AI 报告就有数据。

**接口**：`POST /api/diet/seed/meal_records`

**请求体**：

```json
{
  "records": [
    {
      "user_id": 1,
      "meal_time": "2026-03-14T08:30:00Z",
      "initial_weight": 400,
      "remaining_weight": 80,
      "intake_weight": 320,
      "eating_duration": 1200,
      "eating_speed": 16,
      "total_calories": 520
    },
    {
      "user_id": 1,
      "meal_time": "2026-03-14T12:00:00Z",
      "initial_weight": 350,
      "remaining_weight": 50,
      "intake_weight": 300,
      "eating_duration": 900,
      "eating_speed": 20
    }
  ]
}
```

**字段说明**：

| 字段 | 必填 | 说明 |
|------|------|------|
| user_id | 是 | 用户 ID |
| meal_time | 是 | 用餐时间，支持 RFC3339（如 `2026-03-14T08:30:00Z`）或 `YYYY-MM-DD HH:mm:ss` |
| initial_weight | 否 | 打饭量(g)，默认 0 |
| remaining_weight | 否 | 剩余量(g)，默认 0 |
| intake_weight | 否 | 摄入量(g)，不传则按 initial - remaining 计算 |
| eating_duration | 否 | 用餐时长(秒) |
| eating_speed | 否 | 用餐速度(g/min) |
| total_calories | 否 | 卡路里(kcal) |

**示例（curl）**：

```bash
curl -X POST http://localhost:3000/api/diet/seed/meal_records \
  -H "Content-Type: application/json" \
  -d '{
    "records": [
      {"user_id": 1, "meal_time": "2026-03-14 08:30:00", "initial_weight": 400, "remaining_weight": 80, "intake_weight": 320, "eating_duration": 1200, "eating_speed": 16},
      {"user_id": 1, "meal_time": "2026-03-14 12:00:00", "initial_weight": 350, "remaining_weight": 50, "intake_weight": 300, "eating_duration": 900}
    ]
  }'
```

**后续步骤**（让图表和报告有数据）：

1. 触发该日期的每日汇总：  
   `curl -X POST http://localhost:3000/api/diet/summary/run -H "Content-Type: application/json" -d '{"date":"2026-03-14"}'`
2. 生成该日期的 AI 报告：  
   `curl -X POST http://localhost:3000/api/diet/analysis/generate -H "Content-Type: application/json" -d '{"user_id":1,"date":"2026-03-14","report_type":"daily"}'`

---

### 方式 2：智能餐盒遥测（生成餐盒用餐 + 轨迹）

通过遥测接口模拟一次完整就餐，会自动写入 `Lunchbox_Meals`、`Meal_Curve_Data` 和 `Meal_Records`。

1. **绑定设备**（若尚未绑定）：

```bash
curl -X POST http://localhost:3000/api/v1/devices/bindings \
  -H "Content-Type: application/json" \
  -d '{"device_id":"aa:bb:cc","user_id":1}'
```

2. **执行 7 拍遥测脚本**（项目根目录）：

```bash
bash scripts/test_telemetry_flow.sh
```

或手动按顺序调用多次：

```bash
curl -X POST http://localhost:3000/api/v1/hardware/telemetry \
  -H "Content-Type: application/json" \
  -d '{"device_id":"aa:bb:cc","weight_g":100,"timestamp":1715000000}'
# 再逐步增加/减少 weight_g，触发 IDLE→SERVING→EATING→IDLE
```

---

### 方式 3：仅生成 AI 报告（规则降级）

若已有 `Daily_Diet_Summary` 数据，可直接生成报告；若没有，未配置 OpenAI 时会走规则引擎生成降级报告（仍可得到结果）。

```bash
curl -X POST http://localhost:3000/api/diet/analysis/generate \
  -H "Content-Type: application/json" \
  -d '{"user_id":1,"date":"2026-03-14","report_type":"daily","force_fallback":true}'
```

---

## 二、通过 API 获取数据

导入或生成数据后，可用以下接口**拉取**数据。

### 健康检查

```bash
curl http://localhost:3000/api/v1/ping
# {"message":"pong","timestamp":"2026-03-14T09:10:37Z"}
```

### 历史用餐列表（游标分页）

```bash
curl "http://localhost:3000/api/v1/meals?limit=20"
# 带游标：curl "http://localhost:3000/api/v1/meals?cursor=2026-03-14T04:00:00Z&limit=20"
```

响应：`{ "items": [ { "meal_id", "user_id", "start_time", "duration_minutes", "total_served_g", "total_leftover_g" } ], "next_cursor": "..." }`

### 单次用餐详情

```bash
curl "http://localhost:3000/api/v1/meals/meal_aa_bb_cc_1715000025"
```

### 就餐轨迹

```bash
curl "http://localhost:3000/api/v1/meals/meal_aa_bb_cc_1715000025/trajectory"
# 增量：?last_timestamp=1715000026
# 降采样：?sample_interval=30
```

### 已有 AI 报告

```bash
curl "http://localhost:3000/api/diet/analysis/report?user_id=1&date=2026-03-14"
```

### 个性化建议

```bash
curl "http://localhost:3000/api/diet/recommendations?user_id=1"
```

### 图表数据

```bash
curl "http://localhost:3000/api/diet/statistics/charts?user_id=1&start_date=2026-03-01&end_date=2026-03-14&chart_type=daily_trend"
```

---

## 三、一键导入示例（复制即用）

以下顺序执行：写入 2 条 mock 用餐记录 → 触发 2026-03-14 汇总 → 生成日报 → 查询报告与用餐列表。

```bash
BASE="http://localhost:3000"

# 1. 导入 2 条 mock 用餐记录
curl -s -X POST "$BASE/api/diet/seed/meal_records" -H "Content-Type: application/json" \
  -d '{"records":[{"user_id":1,"meal_time":"2026-03-14 08:30:00","initial_weight":400,"remaining_weight":80,"intake_weight":320,"eating_duration":1200,"eating_speed":16},{"user_id":1,"meal_time":"2026-03-14 12:00:00","initial_weight":350,"remaining_weight":50,"intake_weight":300,"eating_duration":900}]}'

# 2. 触发该日汇总
curl -s -X POST "$BASE/api/diet/summary/run" -H "Content-Type: application/json" -d '{"date":"2026-03-14"}'

# 3. 生成日报
curl -s -X POST "$BASE/api/diet/analysis/generate" -H "Content-Type: application/json" -d '{"user_id":1,"date":"2026-03-14","report_type":"daily"}'

# 4. 获取报告与用餐列表
curl -s "$BASE/api/diet/analysis/report?user_id=1&date=2026-03-14"
curl -s "$BASE/api/v1/meals?limit=5"
```

生产环境将 `BASE` 改为 `https://api.mit.chenyuxia.com` 即可（路径仍为 `/api/v1` 或 `/api/diet/...`）。

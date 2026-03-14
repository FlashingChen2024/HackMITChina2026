#!/bin/bash
# 通过 API 导入 Mock 用餐记录并触发汇总与报告（便于图表/日报有数据）
# 使用前请先启动后端：npm start
# 用法：bash scripts/seed_mock_meal_records.sh [BASE_URL]，默认 http://localhost:3000

BASE="${1:-http://localhost:3000}"
DATE="${2:-2026-03-14}"

echo "Base URL: $BASE  Date: $DATE"
echo "1. 导入 Mock 用餐记录..."
curl -s -X POST "$BASE/api/diet/seed/meal_records" -H "Content-Type: application/json" \
  -d "{\"records\":[
    {\"user_id\":1,\"meal_time\":\"$DATE 08:30:00\",\"initial_weight\":400,\"remaining_weight\":80,\"intake_weight\":320,\"eating_duration\":1200,\"eating_speed\":16},
    {\"user_id\":1,\"meal_time\":\"$DATE 12:00:00\",\"initial_weight\":350,\"remaining_weight\":50,\"intake_weight\":300,\"eating_duration\":900}
  ]}"
echo ""
echo "2. 触发每日汇总..."
curl -s -X POST "$BASE/api/diet/summary/run" -H "Content-Type: application/json" -d "{\"date\":\"$DATE\"}"
echo ""
echo "3. 生成日报..."
curl -s -X POST "$BASE/api/diet/analysis/generate" -H "Content-Type: application/json" -d "{\"user_id\":1,\"date\":\"$DATE\",\"report_type\":\"daily\"}"
echo ""
echo "完成。可访问前端图表/报告页或调用 GET /api/diet/analysis/report、GET /api/v1/meals 等获取数据。"

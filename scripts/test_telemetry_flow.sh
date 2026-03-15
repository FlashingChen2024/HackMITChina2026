#!/bin/bash
# v4.0 遥测：weights 四格，未绑定设备会 403。先登录拿 Token，再绑定设备，再发遥测。
# 用法：bash scripts/test_telemetry_flow.sh [BASE_URL]，默认 http://localhost:3000

BASE="${1:-http://localhost:3000}"
DEV="ESP32_A1B2C3"

echo "1. 注册并登录获取 Token..."
REG=$(curl -s -X POST "$BASE/api/v1/auth/register" -H "Content-Type: application/json" -d '{"username":"testuser","password":"testpass"}')
LOGIN=$(curl -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"testuser","password":"testpass"}')
TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  echo "登录失败，请检查后端与 Users 表（npm run migrate）"
  exit 1
fi

echo "2. 绑定设备..."
curl -s -X POST "$BASE/api/v1/devices/bind" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"device_id\":\"$DEV\"}"
echo ""

echo "3. 发送遥测（weights 四格）..."
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000000,\"weights\":{\"grid_1\":25,\"grid_2\":25,\"grid_3\":25,\"grid_4\":25}}"
echo ""
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000005,\"weights\":{\"grid_1\":100,\"grid_2\":100,\"grid_3\":100,\"grid_4\":100}}"
echo ""
echo "完成。可查 Lunchbox_Meals、Meal_Curve_Data、Meal_Records 验证。"

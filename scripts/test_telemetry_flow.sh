#!/bin/bash
# v4.0 遥测：完整 FSM 流程（IDLE→SERVING→EATING→结算），写入 Lunchbox_Meals + Meal_Records。
# 用法：
#   bash scripts/test_telemetry_flow.sh [BASE_URL]
#   或使用当前登录用户的 Token：TOKEN="你的Bearer Token" bash scripts/test_telemetry_flow.sh
# 若未传 TOKEN，脚本会注册 testuser 并登录；若要用自己的数据，请先登录获取 Token 后传入 TOKEN。

BASE="${1:-http://localhost:3000}"
DEV="${DEVICE_ID:-ESP32_A1B2C3}"
# 2026-03-13 12:00:00 UTC = 1773619200，便于在统计图表中选该日期查看
T0="${TELEMETRY_BASE_TS:-1773619200}"

if [ -n "$TOKEN" ]; then
  echo "使用环境变量 TOKEN 跳过登录"
else
  echo "1. 注册并登录获取 Token..."
  curl -s -X POST "$BASE/api/v1/auth/register" -H "Content-Type: application/json" -d '{"username":"testuser","password":"testpass"}' > /dev/null
  LOGIN=$(curl -s -X POST "$BASE/api/v1/auth/login" -H "Content-Type: application/json" -d '{"username":"testuser","password":"testpass"}')
  TOKEN=$(echo "$LOGIN" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
  if [ -z "$TOKEN" ]; then
    echo "登录失败，请检查后端与 Users 表（npm run migrate）"
    exit 1
  fi
fi

echo "2. 绑定设备 $DEV ..."
curl -s -X POST "$BASE/api/v1/devices/bind" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "{\"device_id\":\"$DEV\"}"
echo ""

echo "3. 发送完整遥测序列（触发一次打饭→就餐→结算）..."
# IDLE: 首点
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$T0,\"weights\":{\"grid_1\":0,\"grid_2\":0,\"grid_3\":0,\"grid_4\":0}}"
echo ""
# IDLE→SERVING: 60s 内增加 >50g
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$((T0+5)),\"weights\":{\"grid_1\":25,\"grid_2\":25,\"grid_3\":25,\"grid_4\":25}}"
echo ""
# SERVING: 首次不增加，记下 non_increase_since
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$((T0+20)),\"weights\":{\"grid_1\":25,\"grid_2\":25,\"grid_3\":25,\"grid_4\":25}}"
echo ""
# SERVING: 再等 15s 不增加 → 进入 EATING，创建 Lunchbox_Meals
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$((T0+35)),\"weights\":{\"grid_1\":25,\"grid_2\":25,\"grid_3\":25,\"grid_4\":25}}"
echo ""
# EATING: 重量下降
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$((T0+40)),\"weights\":{\"grid_1\":10,\"grid_2\":10,\"grid_3\":10,\"grid_4\":10}}"
echo ""
# EATING: 剩余 <10g → 结算，写入 Meal_Records
curl -s -X POST "$BASE/api/v1/hardware/telemetry" -H "Content-Type: application/json" \
  -d "{\"device_id\":\"$DEV\",\"timestamp\":$((T0+45)),\"weights\":{\"grid_1\":1,\"grid_2\":1,\"grid_3\":1,\"grid_4\":1}}"
echo ""

DATE_FOR_SUMMARY="2026-03-13"
echo "4. 完成。请对当日执行「每日汇总」后，在统计图表中选择 $DATE_FOR_SUMMARY 查看："
echo "   curl -X POST $BASE/api/diet/summary/run -H \"Content-Type: application/json\" -H \"Authorization: Bearer \$TOKEN\" -d '{\"date\":\"$DATE_FOR_SUMMARY\"}'"
echo "   （若使用本脚本生成的 TOKEN，请先登录你的账号再执行上述 curl，或在前端用同一账号登录后由后端定时任务汇总）"

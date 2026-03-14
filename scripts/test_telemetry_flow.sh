#!/bin/bash
# 新 API：遥测使用 weight_g 单值，模拟状态机 IDLE → SERVING → EATING → IDLE（7 拍）
# 使用前请先启动服务 npm start，并绑定设备：curl -X POST http://localhost:3000/api/v1/devices/bindings -H "Content-Type: application/json" -d '{"device_id":"aa:bb:cc","user_id":1}'

BASE="http://localhost:3000/api/v1/hardware/telemetry"
DEV="aa:bb:cc"

echo "第 1 拍: IDLE 基线 100g"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":100,\"timestamp\":1715000000}"

echo ""
echo "第 2 拍: 5s 后总重 400g → SERVING"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":400,\"timestamp\":1715000005}"

echo ""
echo "第 3 拍: 重量持平 400g，开始计 15s"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":400,\"timestamp\":1715000010}"

echo ""
echo "第 4 拍: 略降 398g"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":398,\"timestamp\":1715000015}"

echo ""
echo "第 5 拍: 略降 395g"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":395,\"timestamp\":1715000020}"

echo ""
echo "第 6 拍: 390g，满 15s 不增重 → EATING，写入 Lunchbox_Meals + 轨迹点"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":390,\"timestamp\":1715000025}"

echo ""
echo "第 7 拍: 总重 5g → 结算 EATING→IDLE，更新 Lunchbox_Meals + 同步 Meal_Records"
curl -s -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"weight_g\":5,\"timestamp\":1715000030}"

echo ""
echo "完成。可查 Lunchbox_Meals、Meal_Curve_Data、Meal_Records 表验证。"

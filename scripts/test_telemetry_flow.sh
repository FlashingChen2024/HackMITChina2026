#!/bin/bash
# 方案 A Step 3：模拟完整状态机 IDLE → SERVING → EATING → IDLE（7 拍）
# 使用前请先启动服务 npm start，并绑定设备：curl -X POST http://localhost:3000/api/v1/devices/bindings -H "Content-Type: application/json" -d '{"device_id":"aa:bb:cc","user_id":1}'

BASE="http://localhost:3000/api/v1/hardware/telemetry"
DEV="aa:bb:cc"

echo "第 1 拍: IDLE 基线 100g"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000000,\"weights\":{\"grid_1\":25,\"grid_2\":25,\"grid_3\":25,\"grid_4\":25}}"

echo "第 2 拍: 5s 后总重 400g → SERVING"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000005,\"weights\":{\"grid_1\":100,\"grid_2\":100,\"grid_3\":100,\"grid_4\":100}}"

echo "第 3 拍: 重量持平 400g，开始计 15s"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000010,\"weights\":{\"grid_1\":100,\"grid_2\":100,\"grid_3\":100,\"grid_4\":100}}"

echo "第 4 拍: 略降 398g"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000015,\"weights\":{\"grid_1\":100,\"grid_2\":99,\"grid_3\":100,\"grid_4\":99}}"

echo "第 5 拍: 略降 395g"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000020,\"weights\":{\"grid_1\":99,\"grid_2\":99,\"grid_3\":99,\"grid_4\":98}}"

echo "第 6 拍: 390g，满 15s 不增重 → EATING，写入 Lunchbox_Meals + 轨迹点"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000025,\"weights\":{\"grid_1\":98,\"grid_2\":97,\"grid_3\":98,\"grid_4\":97}}"

echo "第 7 拍: 总重 5g → 结算 EATING→IDLE，更新 Lunchbox_Meals + 同步 Meal_Records"
curl -s -o /dev/null -w "  HTTP %{http_code}\n" -X POST "$BASE" -H "Content-Type: application/json" -d "{\"device_id\":\"$DEV\",\"timestamp\":1715000030,\"weights\":{\"grid_1\":1,\"grid_2\":1,\"grid_3\":2,\"grid_4\":1}}"

echo "完成。可查 Lunchbox_Meals、Meal_Curve_Data、Meal_Records 表验证。"

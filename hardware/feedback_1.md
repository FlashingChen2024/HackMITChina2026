# 反馈单 1：Telemetry 返回 200 但 `GET /meals` 一直为空

## 1. 问题概述

硬件端向 `POST /api/v1/hardware/telemetry` 上报已成功（HTTP 200），但云端 `GET /api/v1/meals` 持续返回空列表，未看到期望的用餐记录。

## 2. 环境信息

- 设备端：ESP32-S3-N8R2 + 4 路 HX711
- 设备 ID：`206EF1D61A84`
- API 基址：`https://api.mit.chenyuxia.com/api/v1`
- 发生时间（UTC+8）：2026-03-14 09:34 ~ 09:39

## 3. 当前上报格式（已按最新 API 文档对齐）

```json
{
  "device_id": "206EF1D61A84",
  "weight_g": 0,
  "timestamp": "1773480856"
}
```

说明：
- `weight_g` 为整型（当前总重量，克）
- `timestamp` 为 Unix 秒字符串（文档允许）

## 4. 关键现象与证据

### 4.1 Telemetry 请求成功

设备串口示例：

```text
Telemetry JSON: {"device_id":"206EF1D61A84","weight_g":0,"timestamp":"1773480856"}
Telemetry HTTP Status: 200
Telemetry HTTP Body: {"current_state":"SERVING","device_id":"206EF1D61A84","previous_state":"SERVING","timestamp":"2026-03-14T09:34:16Z"}
```

### 4.2 Meals 列表为空

同时间窗内直接请求：

```text
GET /api/v1/meals -> 200 {"items":[],"next_cursor":""}
```

### 4.3 状态机似乎长期停留在 SERVING

在多次上报（含 `weight_g` = 0 / 200 / 500 / 800）后，返回仍反复出现：

```json
{
  "previous_state": "SERVING",
  "current_state": "SERVING"
}
```

## 5. 复现步骤

1. 启动设备并连接网络，持续向 `/hardware/telemetry` 每 5 秒上报。
2. 观察串口确认上报 `HTTP 200`。
3. 同时查询 `GET /api/v1/meals`。
4. 实际结果：`/meals` 返回空数组。

## 6. 预期结果

- 当 telemetry 持续上报并满足业务条件后，`GET /api/v1/meals` 应出现对应记录；
- 或至少在文档中明确 `/meals` 的入库/可见条件（例如：只展示已结束会话、需要用户绑定、最小时长/阈值等）。

## 7. 初步结论（硬件侧）

- 不是“发送失败”问题：Telemetry 明确返回 200 且返回体含状态机字段；
- 更像是“业务态未收口/未入列表”的后端规则问题，或 `/meals` 查询维度与该设备上报流不一致。

## 8. 需要后端协助确认

请按 `device_id=206EF1D61A84` 核查：

1. telemetry 原始记录是否已入库（按 2026-03-14 09:34 之后时间窗）。
2. 状态机是否卡在 `SERVING`，未触发结束态。
3. `/meals` 的出数条件是否为“仅已完成会话”或需要额外字段/关系（如用户绑定）。
4. 若当前 payload 仍有缺失字段，请提供服务端实际校验 schema（与文档保持一致）。


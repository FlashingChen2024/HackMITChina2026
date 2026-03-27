#pragma once

#include <Arduino.h>
#include "wifi_config.h"

// 标定模式开关：打开后仅输出原始 ADC 与推荐比例因子；关闭后输出真实克数。
// #define CALIBRATION_MODE

namespace app {
constexpr uint32_t kSerialBaud = 115200;
constexpr uint32_t kSensorSampleIntervalMs = 100;
constexpr uint8_t kCalibrationReadSamples = 5;
constexpr uint8_t kRuntimeReadSamples = 1;
constexpr uint8_t kFilterWindowSize = 5;
constexpr uint8_t kTareSamples = 20;
constexpr float kCalibrationKnownWeightG = 100.0f;

constexpr uint32_t kWifiConnectTimeoutMs = 20000;
constexpr uint32_t kWifiReconnectIntervalMs = 3000;
constexpr uint32_t kNtpSyncTimeoutMs = 10000;
constexpr uint32_t kTelemetryIntervalMs = 5000;
constexpr uint32_t kHttpTimeoutMs = 3000;
constexpr long kGmtOffsetSeconds = 8 * 3600;
constexpr long kDstOffsetSeconds = 0;
constexpr const char* kPingUrl = "https://api.mit.chenyuxia.com/api/v1/ping";
constexpr const char* kTelemetryUrl =
    "https://api.mit.chenyuxia.com/api/v1/hardware/telemetry";
constexpr const char* kNtpPrimary = "pool.ntp.org";
constexpr const char* kNtpBackup1 = "ntp.aliyun.com";
constexpr const char* kNtpBackup2 = "time.cloudflare.com";

constexpr const char* kWifiSsid = WIFI_SSID;
constexpr const char* kWifiPassword = WIFI_PASSWORD;
}  // namespace app

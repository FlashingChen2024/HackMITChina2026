#include <Arduino.h>
#include <ctime>
#include <cmath>
#include "app_config.h"
#include "network_service.h"
#include "sensor_array.h"
#include "telemetry_service.h"

namespace {
SensorArray gSensors;
NetworkService gNetwork;
TelemetryService gTelemetry;
String gDeviceId;
constexpr uint8_t kBootStageCount = 8;

float sanitizeWeightForUpload(float value) {
  if (!std::isfinite(value)) {
    return 0.0f;
  }
  if (value < 0.0f) {
    value = 0.0f;
  }
  return std::roundf(value * 10.0f) / 10.0f;
}

String formatIso8601Utc(time_t timestamp) {
  if (timestamp <= 0) {
    return "";
  }

  struct tm utcTime = {};
  gmtime_r(&timestamp, &utcTime);

  char buffer[21] = {0};
  if (std::strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", &utcTime) ==
      0) {
    return "";
  }
  return String(buffer);
}

void logBootStage(uint8_t stage, const char* message) {
  Serial.printf("[BOOT][%u/%u] %s\n", stage, kBootStageCount, message);
}
}  // namespace

void setup() {
  Serial.begin(app::kSerialBaud);
  Serial.println();
  logBootStage(1, "Serial online. MIT-Hardware HX711 bring-up started.");

  logBootStage(2, "Initializing HX711 channels...");
  gSensors.begin();
  logBootStage(2, "HX711 channel initialization complete.");

#ifdef CALIBRATION_MODE
  logBootStage(3, "Entering calibration mode.");
  gNetwork.shutdownWifi();
  gSensors.setCalibrationMode();
  logBootStage(4, "Running tare for all HX711 channels...");
  gSensors.tareAll();
  logBootStage(4, "Tare stage finished.");
  Serial.println("[CALIBRATION_MODE]");
  Serial.printf("Place %.1fg standard weight on ONE grid when calibrating.\n",
                app::kCalibrationKnownWeightG);
  Serial.println(
      "Read each channel factor from serial: factor = (raw - offset) / weight.");
  logBootStage(8, "Calibration boot flow complete. Sampling loop is active.");
#else
  logBootStage(3, "Entering production mode.");
  gSensors.setProductionMode();
  logBootStage(4, "Running tare for all HX711 channels...");
  gSensors.tareAll();
  logBootStage(4, "Tare stage finished.");
  Serial.println("[PRODUCTION_MODE]");
  Serial.println(
      "Using hard-coded factors. Replace per-grid scaleFactor with measured "
      "values.");
  logBootStage(5, "Reading device MAC address...");
  gDeviceId = gNetwork.getMacAddress();
  if (gDeviceId.length() > 0) {
    Serial.printf("Device MAC: %s\n", gDeviceId.c_str());
  } else {
    Serial.println("Device MAC unavailable at boot.");
  }
  logBootStage(5, "Device identity stage complete.");

  logBootStage(6, "Connecting WiFi...");
  const bool wifiOk =
      gNetwork.connectWiFi(app::kWifiSsid, app::kWifiPassword);
  if (wifiOk) {
    logBootStage(6, "WiFi connected.");
    logBootStage(7, "Syncing NTP clock...");
    gNetwork.syncNtpClock();
    logBootStage(7, "NTP sync stage complete.");
    logBootStage(8, "Pinging backend...");
    gNetwork.pingBackend();
    logBootStage(8, "Backend reachability stage complete.");
  } else {
    Serial.println("Skip NTP and ping because WiFi is not connected.");
    logBootStage(8, "Boot finished with offline network state.");
  }
#endif
}

void loop() {
  const uint32_t now = millis();

#ifdef CALIBRATION_MODE
  static uint32_t lastCalibrationMs = 0;
  if (lastCalibrationMs == 0) {
    lastCalibrationMs = now;
  }
  if (now - lastCalibrationMs < app::kSensorSampleIntervalMs) {
    return;
  }
  lastCalibrationMs += app::kSensorSampleIntervalMs;
  gSensors.printCalibrationFrame();
#else
  static uint32_t lastSampleMs = 0;
  gNetwork.maintainConnection(now);

  if (lastSampleMs == 0) {
    lastSampleMs = now;
  }
  if (now - lastSampleMs >= app::kSensorSampleIntervalMs) {
    lastSampleMs += app::kSensorSampleIntervalMs;
    gSensors.sample();
    gSensors.printProductionFrame();
  }

  static uint32_t lastTelemetryMs = 0;
  if (lastTelemetryMs == 0) {
    lastTelemetryMs = now;
  }
  if (now - lastTelemetryMs < app::kTelemetryIntervalMs) {
    return;
  }
  lastTelemetryMs += app::kTelemetryIntervalMs;

  if (!gNetwork.isWiFiConnected()) {
    Serial.println("Telemetry skipped: WiFi disconnected.");
    return;
  }

  float weights[SensorArray::kGridCount] = {0};
  const bool weightsReady = gSensors.readWeights(weights, SensorArray::kGridCount);
  if (!weightsReady) {
    Serial.println("Telemetry skipped: sensor data not ready.");
    return;
  }

  if (gDeviceId.length() == 0) {
    gDeviceId = gNetwork.getMacAddress();
  }
  if (gDeviceId.length() == 0) {
    Serial.println("Telemetry skipped: device_id unavailable.");
    return;
  }

  float sanitizedWeights[SensorArray::kGridCount] = {0};
  for (size_t i = 0; i < SensorArray::kGridCount; ++i) {
    sanitizedWeights[i] = sanitizeWeightForUpload(weights[i]);
  }

  const time_t timestamp = time(nullptr);
  const String timestampStr = formatIso8601Utc(timestamp);
  if (timestampStr.length() == 0) {
    Serial.println("Telemetry skipped: timestamp unavailable.");
    return;
  }

  const String payload = gTelemetry.buildPayload(
      gDeviceId, sanitizedWeights, SensorArray::kGridCount, timestampStr);
  Serial.printf("Telemetry JSON: %s\n", payload.c_str());

  int statusCode = -1;
  String responseBody;
  gTelemetry.postPayload(payload, statusCode, responseBody);
  Serial.printf("Telemetry HTTP Status: %d\n", statusCode);
  Serial.printf("Telemetry HTTP Body: %s\n", responseBody.c_str());
#endif
}

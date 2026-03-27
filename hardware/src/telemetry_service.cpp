#include "telemetry_service.h"

#include <ArduinoJson.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <cstdio>

#include "app_config.h"

String TelemetryService::buildPayload(const String& deviceId, const float* weights,
                                      size_t count,
                                      const String& timestamp) const {
  StaticJsonDocument<384> doc;
  doc["device_id"] = deviceId;
  doc["timestamp"] = timestamp;

  JsonObject weightsObject = doc.createNestedObject("weights");
  if (weights != nullptr && count > 0) {
    for (size_t i = 0; i < count; ++i) {
      char key[8] = {0};
      std::snprintf(key, sizeof(key), "grid_%u", static_cast<unsigned>(i + 1));
      weightsObject[key] = weights[i];
    }
  }

  String payload;
  serializeJson(doc, payload);
  return payload;
}

bool TelemetryService::postPayload(const String& payload, int& statusCode,
                                   String& responseBody) const {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, app::kTelemetryUrl)) {
    statusCode = -1;
    responseBody = "HTTP begin failed";
    return false;
  }

  http.setTimeout(app::kHttpTimeoutMs);
  http.addHeader("Content-Type", "application/json");
  statusCode = http.POST(payload);
  responseBody = http.getString();
  http.end();

  return statusCode == HTTP_CODE_OK;
}

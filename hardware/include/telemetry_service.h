#pragma once

#include <Arduino.h>
#include <ctime>

class TelemetryService {
 public:
  String buildPayload(const String& deviceId, const float* weights,
                      size_t count, const String& timestamp) const;
  bool postPayload(const String& payload, int& statusCode,
                   String& responseBody) const;
};

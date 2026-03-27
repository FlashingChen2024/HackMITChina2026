#pragma once

#include <Arduino.h>

class NetworkService {
 public:
  bool connectWiFi(const char* ssid, const char* password);
  void maintainConnection(uint32_t nowMs);
  bool syncNtpClock();
  bool pingBackend();
  void shutdownWifi();
  bool isWiFiConnected() const;
  String getMacAddress() const;

 private:
  static bool hasCredentials(const char* ssid, const char* password);
  String ssid_;
  String password_;
  bool hasCredentials_ = false;
  bool disconnectedNotified_ = false;
  uint32_t lastReconnectAttemptMs_ = 0;
};

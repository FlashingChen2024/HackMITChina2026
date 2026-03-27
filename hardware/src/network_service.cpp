#include "network_service.h"

#include <HTTPClient.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>

#include <cstring>
#include <ctime>

#include "app_config.h"

bool NetworkService::hasCredentials(const char* ssid, const char* password) {
  return ssid != nullptr && password != nullptr && std::strlen(ssid) > 0 &&
         std::strlen(password) > 0;
}

bool NetworkService::connectWiFi(const char* ssid, const char* password) {
  Serial.println("[NET_INIT] WiFi connection stage start.");
  if (!hasCredentials(ssid, password)) {
    Serial.println("[NET_INIT] WiFi credentials are empty.");
    Serial.println("[NET_INIT] Set WIFI_SSID / WIFI_PASSWORD in build_flags first.");
    return false;
  }

  ssid_ = ssid;
  password_ = password;
  hasCredentials_ = true;
  disconnectedNotified_ = false;
  lastReconnectAttemptMs_ = millis();

  Serial.println("[NET_INIT] Configuring WiFi station mode.");
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(false);
  WiFi.begin(ssid, password);
  Serial.printf("[NET_INIT] Connecting to SSID: %s\n", ssid);

  const uint32_t startMs = millis();
  uint32_t lastDotMs = 0;
  Serial.printf("[NET_INIT] Waiting for connection (timeout=%lums)\n",
                static_cast<unsigned long>(app::kWifiConnectTimeoutMs));
  while (WiFi.status() != WL_CONNECTED &&
         millis() - startMs < app::kWifiConnectTimeoutMs) {
    const uint32_t now = millis();
    if (now - lastDotMs >= 500) {
      Serial.print(".");
      lastDotMs = now;
    }
    yield();
  }
  Serial.println();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[NET_INIT] WiFi connect timeout.");
    return false;
  }

  Serial.print("[NET_INIT] WiFi IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("[NET_INIT] WiFi connection stage complete.");
  return true;
}

void NetworkService::maintainConnection(uint32_t nowMs) {
  if (!hasCredentials_) {
    return;
  }

  if (WiFi.status() == WL_CONNECTED) {
    if (disconnectedNotified_) {
      disconnectedNotified_ = false;
      Serial.println("WiFi Reconnected");
      Serial.print("WiFi IP: ");
      Serial.println(WiFi.localIP());
    }
    return;
  }

  if (!disconnectedNotified_) {
    disconnectedNotified_ = true;
    Serial.println("WiFi Disconnected");
  }

  if (nowMs - lastReconnectAttemptMs_ < app::kWifiReconnectIntervalMs) {
    return;
  }
  lastReconnectAttemptMs_ = nowMs;

  Serial.println("WiFi Reconnecting...");
  WiFi.disconnect(false, false);
  WiFi.begin(ssid_.c_str(), password_.c_str());
}

bool NetworkService::syncNtpClock() {
  Serial.println("[NET_INIT] NTP sync stage start.");
  configTime(app::kGmtOffsetSeconds, app::kDstOffsetSeconds, app::kNtpPrimary,
             app::kNtpBackup1, app::kNtpBackup2);

  const uint32_t startMs = millis();
  time_t now = time(nullptr);
  while (now < 1000000000 && millis() - startMs < app::kNtpSyncTimeoutMs) {
    yield();
    now = time(nullptr);
  }

  if (now < 1000000000) {
    Serial.println("[NET_INIT] NTP sync failed.");
    return false;
  }

  Serial.printf("[NET_INIT] Unix Timestamp: %ld\n", static_cast<long>(now));
  Serial.println("[NET_INIT] NTP sync stage complete.");
  return true;
}

bool NetworkService::pingBackend() {
  Serial.printf("[NET_INIT] Backend ping stage start: %s\n", app::kPingUrl);
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  if (!http.begin(client, app::kPingUrl)) {
    Serial.println("[NET_INIT] HTTP begin failed.");
    return false;
  }

  http.setTimeout(app::kHttpTimeoutMs);
  const int code = http.GET();
  const String body = http.getString();
  Serial.printf("[NET_INIT] Ping HTTP Status: %d\n", code);
  Serial.printf("[NET_INIT] Ping Body: %s\n", body.c_str());
  http.end();

  if (code == HTTP_CODE_OK) {
    Serial.println("[NET_INIT] Backend ping stage complete.");
  } else {
    Serial.println("[NET_INIT] Backend ping stage failed.");
  }
  return code == HTTP_CODE_OK;
}

void NetworkService::shutdownWifi() {
  WiFi.disconnect(true);
  WiFi.mode(WIFI_OFF);
}

bool NetworkService::isWiFiConnected() const {
  return WiFi.status() == WL_CONNECTED;
}

String NetworkService::getMacAddress() const {
  String mac = WiFi.macAddress();
  mac.replace(":", "");
  mac.toUpperCase();
  return mac;
}

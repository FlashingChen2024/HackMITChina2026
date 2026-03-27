#pragma once

// 单独维护 WiFi 配置，避免与业务配置混在一起。
// 如需用 platformio.ini 的 -DWIFI_SSID/-DWIFI_PASSWORD 覆盖，保留本文件为空也可。

#ifndef WIFI_SSID
#define WIFI_SSID "REDMI K80 Pro"
#endif

#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "66666666"
#endif

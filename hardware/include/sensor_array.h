#pragma once

#include <Arduino.h>
#include "HX711.h"

class SensorArray {
 public:
  static constexpr size_t kGridCount = 4;

  void begin();
  void setCalibrationMode();
  void setProductionMode();
  void tareAll();
  void sample();
  bool readWeights(float* outWeights, size_t count);
  void printCalibrationFrame();
  void printProductionFrame();

 private:
  struct GridChannel {
    const char* name;
    uint8_t doutPin;
    uint8_t sckPin;
    float scaleFactor;
    HX711 sensor;
  };

  struct FilterState {
    float window[5] = {0};
    uint8_t count = 0;
    uint8_t index = 0;
    float filtered = NAN;
  };

  static bool waitUntilReady(HX711& sensor, uint32_t timeoutMs);
  static float computeTrimmedMean(const float* values, uint8_t count);
  void pushSample(size_t channelIndex, float sample);
  GridChannel channels_[kGridCount] = {
      {"Grid 1", 4, 5, 419.0f},
      {"Grid 2", 6, 7, 430.5f},
      {"Grid 3", 15, 16, 430.5f},
      {"Grid 4", 17, 18, 405.8f},
  };
  FilterState filters_[kGridCount];
};

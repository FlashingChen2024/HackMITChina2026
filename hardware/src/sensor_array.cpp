#include "sensor_array.h"

#include <cmath>

#include "app_config.h"

static_assert(app::kCalibrationKnownWeightG > 0.0f,
              "kCalibrationKnownWeightG must be > 0");

namespace {
void printCalibrationDivider() {
  Serial.println("+--------+--------------+--------------+------------+");
}

void printCalibrationHeader() {
  printCalibrationDivider();
  Serial.println("| Grid   | Raw ADC      | Delta ADC    | Factor     |");
  printCalibrationDivider();
}
}  // namespace

bool SensorArray::waitUntilReady(HX711& sensor, uint32_t timeoutMs) {
  const uint32_t start = millis();
  while (!sensor.is_ready()) {
    if (millis() - start >= timeoutMs) {
      return false;
    }
    yield();
  }
  return true;
}

float SensorArray::computeTrimmedMean(const float* values, uint8_t count) {
  if (count == 0) {
    return NAN;
  }

  float sum = 0.0f;
  float minVal = values[0];
  float maxVal = values[0];
  for (uint8_t i = 0; i < count; ++i) {
    const float v = values[i];
    sum += v;
    if (v < minVal) {
      minVal = v;
    }
    if (v > maxVal) {
      maxVal = v;
    }
  }

  if (count <= 2) {
    return sum / static_cast<float>(count);
  }
  return (sum - minVal - maxVal) / static_cast<float>(count - 2);
}

void SensorArray::pushSample(size_t channelIndex, float sample) {
  auto& filter = filters_[channelIndex];
  filter.window[filter.index] = sample;
  filter.index = (filter.index + 1) % app::kFilterWindowSize;
  if (filter.count < app::kFilterWindowSize) {
    ++filter.count;
  }
  filter.filtered = computeTrimmedMean(filter.window, filter.count);
}

void SensorArray::begin() {
  Serial.println("[SENSOR_INIT] HX711 begin sequence start.");
  for (auto& channel : channels_) {
    Serial.printf("[SENSOR_INIT] %s begin on DOUT=%u SCK=%u\n", channel.name,
                  channel.doutPin, channel.sckPin);
    channel.sensor.begin(channel.doutPin, channel.sckPin);
  }
  Serial.println("[SENSOR_INIT] HX711 begin sequence complete.");
}

void SensorArray::setCalibrationMode() {
  for (auto& channel : channels_) {
    channel.sensor.set_scale(1.0f);
  }
}

void SensorArray::setProductionMode() {
  for (auto& channel : channels_) {
    channel.sensor.set_scale(channel.scaleFactor);
  }
  for (auto& filter : filters_) {
    filter.count = 0;
    filter.index = 0;
    filter.filtered = NAN;
  }
}

void SensorArray::tareAll() {
  Serial.println("[SENSOR_TARE] Boot tare start: current load will be set to 0.");
  uint8_t successCount = 0;
  for (auto& channel : channels_) {
    bool tared = false;
    for (uint8_t attempt = 1; attempt <= 3; ++attempt) {
      if (!waitUntilReady(channel.sensor, 3000)) {
        Serial.printf("[SENSOR_TARE] %s not ready (attempt %u/3)\n",
                      channel.name, attempt);
        continue;
      }
      channel.sensor.tare(app::kTareSamples);
      tared = true;
      break;
    }
    if (tared) {
      ++successCount;
      Serial.printf("[SENSOR_TARE] %s tare OK (current weight -> 0)\n",
                    channel.name);
    } else {
      Serial.printf("[SENSOR_TARE] %s tare FAILED\n", channel.name);
    }
  }
  Serial.printf("[SENSOR_TARE] Finished: %u/%u channel(s) tared successfully.\n",
                successCount, static_cast<unsigned>(kGridCount));
}

bool SensorArray::readWeights(float* outWeights, size_t count) {
  if (outWeights == nullptr || count < kGridCount) {
    return false;
  }

  bool allReady = true;
  for (size_t i = 0; i < kGridCount; ++i) {
    outWeights[i] = filters_[i].filtered;
    if (std::isnan(outWeights[i])) {
      allReady = false;
    }
  }
  return allReady;
}

void SensorArray::sample() {
  for (size_t i = 0; i < kGridCount; ++i) {
    auto& channel = channels_[i];
    if (!channel.sensor.is_ready()) {
      filters_[i].filtered = NAN;
      continue;
    }
    const float grams = channel.sensor.get_units(app::kRuntimeReadSamples);
    pushSample(i, grams);
  }
}

void SensorArray::printCalibrationFrame() {
  static uint32_t frameCounter = 0;
  if (frameCounter % 10 == 0) {
    printCalibrationHeader();
  }
  ++frameCounter;

  for (size_t i = 0; i < kGridCount; ++i) {
    auto& channel = channels_[i];
    if (!channel.sensor.is_ready()) {
      Serial.printf("| %-6s | %12s | %12s | %10s |\n", channel.name, "NA", "NA",
                    "NA");
      continue;
    }

    const long raw = channel.sensor.read_average(app::kCalibrationReadSamples);
    const long delta = raw - channel.sensor.get_offset();
    const float suggestedFactor = delta / app::kCalibrationKnownWeightG;
    Serial.printf("| %-6s | %12ld | %12ld | %10.3f |\n", channel.name, raw,
                  delta, suggestedFactor);
  }
  printCalibrationDivider();
}

void SensorArray::printProductionFrame() {
  float weights[kGridCount] = {0};
  readWeights(weights, kGridCount);

  for (size_t i = 0; i < kGridCount; ++i) {
    const auto& channel = channels_[i];
    if (std::isnan(weights[i])) {
      Serial.printf("%s: offline\n", channel.name);
      continue;
    }
    Serial.printf("%s: %.1fg\n", channel.name, weights[i]);
  }
  Serial.println("---");
}

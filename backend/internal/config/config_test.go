package config

import "testing"

func TestLoadAIConfigFromEnv(t *testing.T) {
	t.Setenv("AI_BASE_URL", "https://api.example.com/v1")
	t.Setenv("AI_MODEL", "deepseek-chat")
	t.Setenv("AI_API_KEY", "demo-key")
	t.Setenv("AI_TEMPERATURE", "0.7")

	cfg := Load()

	if cfg.AIBaseURL != "https://api.example.com/v1" {
		t.Fatalf("unexpected AIBaseURL: %s", cfg.AIBaseURL)
	}
	if cfg.AIModel != "deepseek-chat" {
		t.Fatalf("unexpected AIModel: %s", cfg.AIModel)
	}
	if cfg.AIAPIKey != "demo-key" {
		t.Fatalf("unexpected AIAPIKey: %s", cfg.AIAPIKey)
	}
	if cfg.AITemperature != 0.7 {
		t.Fatalf("unexpected AITemperature: %v", cfg.AITemperature)
	}
}

func TestLoadVisionConfigFromEnv(t *testing.T) {
	t.Setenv("VISION_BASE_URL", "https://vision.example.com/v1")
	t.Setenv("VISION_MODEL", "vision-pro")
	t.Setenv("VISION_API_KEY", "vision-key")

	cfg := Load()

	if cfg.VisionBaseURL != "https://vision.example.com/v1" {
		t.Fatalf("unexpected VisionBaseURL: %s", cfg.VisionBaseURL)
	}
	if cfg.VisionModel != "vision-pro" {
		t.Fatalf("unexpected VisionModel: %s", cfg.VisionModel)
	}
	if cfg.VisionAPIKey != "vision-key" {
		t.Fatalf("unexpected VisionAPIKey: %s", cfg.VisionAPIKey)
	}
}

package config

import (
	"os"
	"strconv"
)

const (
	defaultHTTPPort         = "8080"
	defaultMySQLDSN         = "root:root@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
	defaultRedisAddr        = "127.0.0.1:6379"
	defaultJWTSecret        = "kxyz-dev-secret"
	defaultJWTExpireMinutes = 1440
	defaultAIBaseURL        = "https://api.openai.com/v1"
	defaultAIModel          = "gpt-4o-mini"
	defaultAITemperature    = 0.7
	defaultVisionBaseURL    = "https://api.openai.com/v1"
	defaultVisionModel      = "gpt-4o-mini"
	defaultSMTPHost         = "smtp.example.com"
	defaultSMTPPort         = 587
)

type Config struct {
	HTTPPort      string
	MySQLDSN      string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	JWTSecret     string
	JWTExpireMins int
	AIBaseURL     string
	AIModel       string
	AIAPIKey      string
	AITemperature float64
	VisionBaseURL string
	VisionModel   string
	VisionAPIKey  string
	SMTPHost      string
	SMTPPort      int
	SMTPUsername  string
	SMTPPassword  string
	SMTPFrom      string
}

func Load() Config {
	return Config{
		HTTPPort:      getEnv("HTTP_PORT", defaultHTTPPort),
		MySQLDSN:      getEnv("MYSQL_DSN", defaultMySQLDSN),
		RedisAddr:     getEnv("REDIS_ADDR", defaultRedisAddr),
		RedisPassword: getEnv("REDIS_PASSWORD", ""),
		RedisDB:       getEnvInt("REDIS_DB", 0),
		JWTSecret:     getEnv("JWT_SECRET", defaultJWTSecret),
		JWTExpireMins: getEnvInt("JWT_EXPIRE_MINUTES", defaultJWTExpireMinutes),
		AIBaseURL:     getEnv("AI_BASE_URL", defaultAIBaseURL),
		AIModel:       getEnv("AI_MODEL", defaultAIModel),
		AIAPIKey:      getEnv("AI_API_KEY", ""),
		AITemperature: getEnvFloat("AI_TEMPERATURE", defaultAITemperature),
		VisionBaseURL: getEnv("VISION_BASE_URL", defaultVisionBaseURL),
		VisionModel:   getEnv("VISION_MODEL", defaultVisionModel),
		VisionAPIKey:  getEnv("VISION_API_KEY", ""),
		SMTPHost:      getEnv("SMTP_HOST", defaultSMTPHost),
		SMTPPort:      getEnvInt("SMTP_PORT", defaultSMTPPort),
		SMTPUsername:  getEnv("SMTP_USERNAME", ""),
		SMTPPassword:  getEnv("SMTP_PASSWORD", ""),
		SMTPFrom:      getEnv("SMTP_FROM", ""),
	}
}

func getEnv(key string, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.Atoi(value)
	if err != nil {
		return fallback
	}
	return parsed
}

func getEnvFloat(key string, fallback float64) float64 {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseFloat(value, 64)
	if err != nil {
		return fallback
	}
	return parsed
}

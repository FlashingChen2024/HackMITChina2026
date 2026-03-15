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
)

type Config struct {
	HTTPPort      string
	MySQLDSN      string
	RedisAddr     string
	RedisPassword string
	RedisDB       int
	JWTSecret     string
	JWTExpireMins int
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

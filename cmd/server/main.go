package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os/signal"
	"syscall"
	"time"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/config"
	"kxyz-backend/internal/server"
	"kxyz-backend/internal/store"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	cfg := config.Load()

	mysqlDB, err := store.NewMySQL(ctx, cfg.MySQLDSN)
	if err != nil {
		log.Fatalf("mysql init failed: %v", err)
	}
	log.Printf("mysql connected")

	if err := store.AutoMigrate(mysqlDB); err != nil {
		log.Fatalf("auto migrate failed: %v", err)
	}
	log.Printf("auto migrate completed for meals and meal_curve_data")

	redisClient, err := store.NewRedis(ctx, store.RedisConfig{
		Addr:     cfg.RedisAddr,
		Password: cfg.RedisPassword,
		DB:       cfg.RedisDB,
	})
	if err != nil {
		log.Fatalf("redis init failed: %v", err)
	}
	defer redisClient.Close()
	log.Printf("redis connected")

	pingHandler := api.NewPingHandler()
	router := server.NewRouter(pingHandler.Handle)

	httpServer := &http.Server{
		Addr:              ":" + cfg.HTTPPort,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := httpServer.Shutdown(shutdownCtx); err != nil {
			log.Printf("server shutdown error: %v", err)
		}
	}()

	log.Printf("server listening on :%s", cfg.HTTPPort)
	if err := httpServer.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		log.Fatalf("server start failed: %v", err)
	}
}

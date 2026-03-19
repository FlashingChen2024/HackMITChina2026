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
	"kxyz-backend/internal/middleware"
	"kxyz-backend/internal/server"
	"kxyz-backend/internal/service"
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
	log.Printf("auto migrate completed for meals, meal_curve_data, users and device_bindings")

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
	deviceBindingStore := store.NewGormDeviceBindingStore(mysqlDB)
	deviceBindingService := service.NewDeviceBindingService(deviceBindingStore)
	deviceBindingHandler := api.NewDeviceBindingHandler(deviceBindingService)
	deviceStateStore := service.NewRedisDeviceStateStore(redisClient)
	mealPersistence := store.NewGormMealPersistence(mysqlDB)
	telemetryService := service.NewTelemetryService(deviceStateStore, log.Default(), mealPersistence)
	telemetryHandler := api.NewTelemetryHandler(telemetryService, deviceBindingService)
	mealQueryStore := store.NewGormMealQueryStore(mysqlDB)
	mealQueryService := service.NewMealQueryService(mealQueryStore)
	mealsHandler := api.NewMealsHandler(mealQueryService)
	communityStore := store.NewGormCommunityStore(mysqlDB)
	communityService := service.NewCommunityService(communityStore)
	communityHandler := api.NewCommunityHandler(communityService)
	userStore := store.NewGormUserStore(mysqlDB)
	authService := service.NewAuthService(userStore, cfg.JWTSecret, time.Duration(cfg.JWTExpireMins)*time.Minute)
	authHandler := api.NewAuthHandler(authService)
	testAuthHandler := api.NewTestAuthHandler()
	jwtAuthMiddleware := middleware.JWTAuthMiddleware(authService)

	deviceListHandler := deviceBindingHandler.List
	unbindDeviceHandler := deviceBindingHandler.Unbind

	aiAdviceService := service.NewAiAdviceService()
	aiAdviceHandler := api.NewAiAdviceHandler(aiAdviceService)

	router := server.NewRouter(
		pingHandler.Handle,
		telemetryHandler.Handle,
		authHandler.Register,
		authHandler.Login,
		deviceBindingHandler.Bind,
		deviceListHandler,
		unbindDeviceHandler,
		testAuthHandler.Handle,
		jwtAuthMiddleware,
		mealsHandler.PutFoods,
		mealsHandler.List,
		mealsHandler.GetByID,
		mealsHandler.Trajectory,
		mealsHandler.StatisticsCharts,
		aiAdviceHandler.GetMeAiAdvice,
		communityHandler.Create,
		communityHandler.Join,
		communityHandler.Dashboard,
	)

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

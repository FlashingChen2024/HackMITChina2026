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
	log.Printf("auto migrate completed for meals, meal_curve_data, users, user_profiles and device_bindings")

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
	var visionAnalyzer service.VisionAnalyzer
	visionClient, visionErr := service.NewOpenAIVisionClient(service.VisionClientConfig{
		BaseURL: cfg.VisionBaseURL,
		Model:   cfg.VisionModel,
		APIKey:  cfg.VisionAPIKey,
	})
	if visionErr != nil {
		log.Printf("vision client disabled: %v", visionErr)
	} else {
		visionAnalyzer = visionClient
		log.Printf("vision client enabled with base_url=%s model=%s", cfg.VisionBaseURL, cfg.VisionModel)
	}
	visionAnalyzeHandler := api.NewVisionAnalyzeHandler(visionAnalyzer)
	aiAdviceStore := store.NewGormAIAdviceStore(mysqlDB)
	var aiGenerator service.AITextGenerator
	var aiFoodGenerator service.FoodCalorieGenerator
	aiClient, aiErr := service.NewOpenAICompatibleClient(service.AIModelClientConfig{
		BaseURL:     cfg.AIBaseURL,
		Model:       cfg.AIModel,
		APIKey:      cfg.AIAPIKey,
		Temperature: cfg.AITemperature,
	})
	if aiErr != nil {
		log.Printf("ai client disabled: %v", aiErr)
	} else {
		aiGenerator = aiClient
		aiFoodGenerator = aiClient
		log.Printf("ai client enabled with base_url=%s model=%s", cfg.AIBaseURL, cfg.AIModel)
	}
	foodLibrary := service.NewLLMFoodLibrary(service.NewStaticFoodLibrary(), aiFoodGenerator)
	foodLibraryHandler := api.NewFoodLibraryHandler(foodLibrary)
	mealQueryStore := store.NewGormMealQueryStore(mysqlDB)
	mealQueryService := service.NewMealQueryService(mealQueryStore)
	mealsHandler := api.NewMealsHandler(mealQueryService)
	visionConfirmHandler := api.NewVisionConfirmHandler(mealQueryService, foodLibrary)
	aiAdviceService := service.NewAIAdviceService(aiAdviceStore, aiGenerator)
	aiAdviceHandler := api.NewAIAdviceHandler(aiAdviceService, log.Default())
	userProfileStore := store.NewGormUserProfileStore(mysqlDB)
	userProfileService := service.NewUserProfileService(userProfileStore)
	userProfileHandler := api.NewUserProfileHandler(userProfileService)
	communityStore := store.NewGormCommunityStore(mysqlDB)
	communityService := service.NewCommunityService(communityStore)
	communityHandler := api.NewCommunityHandler(communityService)
	alertSettingStore := store.NewGormAlertSettingStore(mysqlDB)
	alertSettingService := service.NewAlertSettingService(alertSettingStore)
	alertSettingHandler := api.NewAlertSettingHandler(alertSettingService)
	userStore := store.NewGormUserStore(mysqlDB)
	authService := service.NewAuthService(userStore, cfg.JWTSecret, time.Duration(cfg.JWTExpireMins)*time.Minute)
	authHandler := api.NewAuthHandler(authService)
	testAuthHandler := api.NewTestAuthHandler()
	jwtAuthMiddleware := middleware.JWTAuthMiddleware(authService)
	router := server.NewRouter(
		pingHandler.Handle,
		telemetryHandler.Handle,
		visionAnalyzeHandler.Analyze,
		foodLibraryHandler.Search,
		authHandler.Register,
		authHandler.Login,
		deviceBindingHandler.Bind,
		deviceBindingHandler.List,
		deviceBindingHandler.Unbind,
		testAuthHandler.Handle,
		jwtAuthMiddleware,
		mealsHandler.PutFoods,
		mealsHandler.List,
		mealsHandler.GetByID,
		mealsHandler.Trajectory,
		mealsHandler.StatisticsCharts,
		aiAdviceHandler.Get,
		userProfileHandler.Upsert,
		userProfileHandler.Get,
		visionConfirmHandler.Confirm,
		communityHandler.Create,
		communityHandler.Join,
		communityHandler.List,
		communityHandler.Dashboard,
		alertSettingHandler.Upsert,
		alertSettingHandler.Get,
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

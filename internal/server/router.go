package server

import "github.com/gin-gonic/gin"

func NewRouter(
	pingHandler gin.HandlerFunc,
	telemetryHandler gin.HandlerFunc,
	registerHandler gin.HandlerFunc,
	loginHandler gin.HandlerFunc,
	bindDeviceHandler gin.HandlerFunc,
	listDevicesHandler gin.HandlerFunc,
	unbindDeviceHandler gin.HandlerFunc,
	testAuthHandler gin.HandlerFunc,
	jwtAuthMiddleware gin.HandlerFunc,
	putMealFoodsHandler gin.HandlerFunc,
	listMealsHandler gin.HandlerFunc,
	mealDetailHandler gin.HandlerFunc,
	mealTrajectoryHandler gin.HandlerFunc,
	statisticsChartsHandler gin.HandlerFunc,
	aiAdviceHandler gin.HandlerFunc,
	createCommunityHandler gin.HandlerFunc,
	joinCommunityHandler gin.HandlerFunc,
	listCommunitiesHandler gin.HandlerFunc,
	communityDashboardHandler gin.HandlerFunc,
) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	router.GET("/ping", pingHandler)
	router.POST("/hardware/telemetry", telemetryHandler)
	router.POST("/auth/register", registerHandler)
	router.POST("/auth/login", loginHandler)
	authorized := router.Group("")
	authorized.Use(jwtAuthMiddleware)
	authorized.GET("/test_auth", testAuthHandler)
	authorized.POST("/devices/bind", bindDeviceHandler)
	authorized.GET("/devices", listDevicesHandler)
	authorized.DELETE("/devices/:device_id", unbindDeviceHandler)
	authorized.GET("/meals", listMealsHandler)
	authorized.GET("/meals/:meal_id", mealDetailHandler)
	authorized.GET("/meals/:meal_id/trajectory", mealTrajectoryHandler)
	authorized.GET("/users/me/statistics/charts", statisticsChartsHandler)
	authorized.GET("/users/me/ai-advice", aiAdviceHandler)
	authorized.PUT("/meals/:meal_id/foods", putMealFoodsHandler)
	authorized.POST("/communities/create", createCommunityHandler)
	authorized.POST("/communities/:community_id/join", joinCommunityHandler)
	authorized.GET("/communities", listCommunitiesHandler)
	authorized.GET("/communities/:community_id/dashboard", communityDashboardHandler)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/ping", pingHandler)
		v1.POST("/hardware/telemetry", telemetryHandler)
		v1.POST("/auth/register", registerHandler)
		v1.POST("/auth/login", loginHandler)
		v1Authorized := v1.Group("")
		v1Authorized.Use(jwtAuthMiddleware)
		v1Authorized.GET("/test_auth", testAuthHandler)
		v1Authorized.POST("/devices/bind", bindDeviceHandler)
		v1Authorized.GET("/devices", listDevicesHandler)
		v1Authorized.DELETE("/devices/:device_id", unbindDeviceHandler)
		v1Authorized.GET("/meals", listMealsHandler)
		v1Authorized.GET("/meals/:meal_id", mealDetailHandler)
		v1Authorized.GET("/meals/:meal_id/trajectory", mealTrajectoryHandler)
		v1Authorized.GET("/users/me/statistics/charts", statisticsChartsHandler)
		v1Authorized.GET("/users/me/ai-advice", aiAdviceHandler)
		v1Authorized.PUT("/meals/:meal_id/foods", putMealFoodsHandler)
		v1Authorized.POST("/communities/create", createCommunityHandler)
		v1Authorized.POST("/communities/:community_id/join", joinCommunityHandler)
		v1Authorized.GET("/communities", listCommunitiesHandler)
		v1Authorized.GET("/communities/:community_id/dashboard", communityDashboardHandler)
	}

	return router
}

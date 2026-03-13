package server

import "github.com/gin-gonic/gin"

func NewRouter(
	pingHandler gin.HandlerFunc,
	telemetryHandler gin.HandlerFunc,
	listMealsHandler gin.HandlerFunc,
	mealDetailHandler gin.HandlerFunc,
	mealTrajectoryHandler gin.HandlerFunc,
) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	router.GET("/ping", pingHandler)
	router.POST("/hardware/telemetry", telemetryHandler)
	router.GET("/meals", listMealsHandler)
	router.GET("/meals/:meal_id", mealDetailHandler)
	router.GET("/meals/:meal_id/trajectory", mealTrajectoryHandler)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/ping", pingHandler)
		v1.POST("/hardware/telemetry", telemetryHandler)
		v1.GET("/meals", listMealsHandler)
		v1.GET("/meals/:meal_id", mealDetailHandler)
		v1.GET("/meals/:meal_id/trajectory", mealTrajectoryHandler)
	}

	return router
}

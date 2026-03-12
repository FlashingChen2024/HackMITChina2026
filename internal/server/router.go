package server

import "github.com/gin-gonic/gin"

func NewRouter(pingHandler gin.HandlerFunc) *gin.Engine {
	router := gin.New()
	router.Use(gin.Logger(), gin.Recovery())

	router.GET("/ping", pingHandler)

	v1 := router.Group("/api/v1")
	{
		v1.GET("/ping", pingHandler)
	}

	return router
}

package server_test

import (
	"bytes"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/server"

	"github.com/gin-gonic/gin"
)

func TestPingRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pingHandler := api.NewPingHandler()
	router := server.NewRouter(pingHandler.Handle, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
}

func TestTelemetryRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pingHandler := api.NewPingHandler()
	router := server.NewRouter(pingHandler.Handle, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hardware/telemetry", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
}

func TestMealsRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)

	pingHandler := api.NewPingHandler()
	router := server.NewRouter(pingHandler.Handle, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	}, func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/meals", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected meals list status 200, got %d", listResp.Code)
	}

	detailReq := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1", nil)
	detailResp := httptest.NewRecorder()
	router.ServeHTTP(detailResp, detailReq)
	if detailResp.Code != http.StatusOK {
		t.Fatalf("expected meal detail status 200, got %d", detailResp.Code)
	}

	trajReq := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1/trajectory", nil)
	trajResp := httptest.NewRecorder()
	router.ServeHTTP(trajResp, trajReq)
	if trajResp.Code != http.StatusOK {
		t.Fatalf("expected meal trajectory status 200, got %d", trajResp.Code)
	}
}

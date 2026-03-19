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

func buildRouter(jwtMiddleware gin.HandlerFunc) *gin.Engine {
	pingHandler := api.NewPingHandler()
	return server.NewRouter(
		pingHandler.Handle,
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		jwtMiddleware,
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
		func(c *gin.Context) { c.Status(http.StatusOK) },
	)
}

func TestPingRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := buildRouter(func(c *gin.Context) { c.Next() })

	req := httptest.NewRequest(http.MethodGet, "/api/v1/ping", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
}

func TestTelemetryRoute(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := buildRouter(func(c *gin.Context) { c.Next() })

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
	router := buildRouter(func(c *gin.Context) { c.Next() })

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

	statsReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/statistics/charts", nil)
	statsResp := httptest.NewRecorder()
	router.ServeHTTP(statsResp, statsReq)
	if statsResp.Code != http.StatusOK {
		t.Fatalf("expected statistics charts status 200, got %d", statsResp.Code)
	}

	aiReq := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice", nil)
	aiResp := httptest.NewRecorder()
	router.ServeHTTP(aiResp, aiReq)
	if aiResp.Code != http.StatusOK {
		t.Fatalf("expected ai advice status 200, got %d", aiResp.Code)
	}
}

func TestAuthRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := buildRouter(func(c *gin.Context) { c.Next() })

	registerReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register", bytes.NewBufferString(`{}`))
	registerReq.Header.Set("Content-Type", "application/json")
	registerResp := httptest.NewRecorder()
	router.ServeHTTP(registerResp, registerReq)
	if registerResp.Code != http.StatusOK {
		t.Fatalf("expected register status 200, got %d", registerResp.Code)
	}

	loginReq := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login", bytes.NewBufferString(`{}`))
	loginReq.Header.Set("Content-Type", "application/json")
	loginResp := httptest.NewRecorder()
	router.ServeHTTP(loginResp, loginReq)
	if loginResp.Code != http.StatusOK {
		t.Fatalf("expected login status 200, got %d", loginResp.Code)
	}
}

func TestCommunityRoutes(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := buildRouter(func(c *gin.Context) { c.Next() })

	createReq := httptest.NewRequest(
		http.MethodPost,
		"/api/v1/communities/create",
		bytes.NewBufferString(`{"name":"MIT","description":"demo"}`),
	)
	createReq.Header.Set("Content-Type", "application/json")
	createResp := httptest.NewRecorder()
	router.ServeHTTP(createResp, createReq)
	if createResp.Code != http.StatusOK {
		t.Fatalf("expected create community status 200, got %d", createResp.Code)
	}

	joinReq := httptest.NewRequest(http.MethodPost, "/api/v1/communities/community-1/join", nil)
	joinResp := httptest.NewRecorder()
	router.ServeHTTP(joinResp, joinReq)
	if joinResp.Code != http.StatusOK {
		t.Fatalf("expected join community status 200, got %d", joinResp.Code)
	}

	listReq := httptest.NewRequest(http.MethodGet, "/api/v1/communities", nil)
	listResp := httptest.NewRecorder()
	router.ServeHTTP(listResp, listReq)
	if listResp.Code != http.StatusOK {
		t.Fatalf("expected list communities status 200, got %d", listResp.Code)
	}

	dashboardReq := httptest.NewRequest(http.MethodGet, "/api/v1/communities/community-1/dashboard", nil)
	dashboardResp := httptest.NewRecorder()
	router.ServeHTTP(dashboardResp, dashboardReq)
	if dashboardResp.Code != http.StatusOK {
		t.Fatalf("expected community dashboard status 200, got %d", dashboardResp.Code)
	}
}

func TestProtectedRoutesRequireJWT(t *testing.T) {
	gin.SetMode(gin.TestMode)
	router := buildRouter(func(c *gin.Context) {
		c.AbortWithStatus(http.StatusUnauthorized)
	})

	cases := []struct {
		method string
		path   string
		body   string
	}{
		{method: http.MethodGet, path: "/api/v1/test_auth"},
		{method: http.MethodPost, path: "/api/v1/devices/bind", body: `{}`},
		{method: http.MethodGet, path: "/api/v1/devices"},
		{method: http.MethodDelete, path: "/api/v1/devices/device-1"},
		{method: http.MethodGet, path: "/api/v1/meals"},
		{method: http.MethodGet, path: "/api/v1/meals/meal-1"},
		{method: http.MethodGet, path: "/api/v1/meals/meal-1/trajectory"},
		{method: http.MethodGet, path: "/api/v1/users/me/statistics/charts"},
		{method: http.MethodGet, path: "/api/v1/users/me/ai-advice"},
		{method: http.MethodPut, path: "/api/v1/meals/meal-1/foods", body: `{"grids":[]}`},
		{method: http.MethodPost, path: "/api/v1/communities/create", body: `{"name":"MIT","description":"demo"}`},
		{method: http.MethodPost, path: "/api/v1/communities/community-1/join"},
		{method: http.MethodGet, path: "/api/v1/communities"},
		{method: http.MethodGet, path: "/api/v1/communities/community-1/dashboard"},
	}

	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, bytes.NewBufferString(tc.body))
		if tc.body != "" {
			req.Header.Set("Content-Type", "application/json")
		}
		resp := httptest.NewRecorder()
		router.ServeHTTP(resp, req)
		if resp.Code != http.StatusUnauthorized {
			t.Fatalf("expected %s %s to return 401, got %d", tc.method, tc.path, resp.Code)
		}
	}
}

package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type fakeDeviceBindingService struct {
	lastUserID   string
	lastDeviceID string
	devices      []string
	bindErr      error
	listErr      error
	unbindErr    error
}

func (f *fakeDeviceBindingService) BindDevice(_ context.Context, userID string, deviceID string) error {
	f.lastUserID = userID
	f.lastDeviceID = deviceID
	return f.bindErr
}

func (f *fakeDeviceBindingService) ListDevices(_ context.Context, userID string) ([]string, error) {
	f.lastUserID = userID
	return f.devices, f.listErr
}

func (f *fakeDeviceBindingService) UnbindDevice(_ context.Context, userID string, deviceID string) error {
	f.lastUserID = userID
	f.lastDeviceID = deviceID
	return f.unbindErr
}

func TestDeviceBindSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeDeviceBindingService{}
	handler := api.NewDeviceBindingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/devices/bind", handler.Bind)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/devices/bind",
		bytes.NewBufferString(`{"device_id":"esp32_a1b2c3"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", svc.lastUserID)
	}
	if svc.lastDeviceID != "esp32_a1b2c3" {
		t.Fatalf("expected device_id esp32_a1b2c3, got %s", svc.lastDeviceID)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["message"] != "device bind success" {
		t.Fatalf("expected message=device bind success, got %v", payload["message"])
	}
	if payload["device_id"] != "ESP32_A1B2C3" {
		t.Fatalf("expected uppercase device_id, got %v", payload["device_id"])
	}
}

func TestDeviceBindConflict(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeDeviceBindingService{bindErr: service.ErrDeviceBoundToAnother}
	handler := api.NewDeviceBindingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/devices/bind", handler.Bind)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/devices/bind",
		bytes.NewBufferString(`{"device_id":"esp32_a1b2c3"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d", resp.Code)
	}
}

func TestDeviceListSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeDeviceBindingService{devices: []string{"ESP32_A1B2C3"}}
	handler := api.NewDeviceBindingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/devices", handler.List)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/devices", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", svc.lastUserID)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	items, ok := payload["devices"].([]any)
	if !ok || len(items) != 1 || items[0] != "ESP32_A1B2C3" {
		t.Fatalf("unexpected devices payload: %v", payload["devices"])
	}
}

func TestDeviceUnbindForbidden(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeDeviceBindingService{unbindErr: service.ErrDeviceForbidden}
	handler := api.NewDeviceBindingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.DELETE("/api/v1/devices/:device_id", handler.Unbind)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/devices/esp32_a1b2c3", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusForbidden {
		t.Fatalf("expected status 403, got %d", resp.Code)
	}
}

func TestDeviceUnbindSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeDeviceBindingService{}
	handler := api.NewDeviceBindingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.DELETE("/api/v1/devices/:device_id", handler.Unbind)

	req := httptest.NewRequest(http.MethodDelete, "/api/v1/devices/esp32_a1b2c3", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", svc.lastUserID)
	}
	if svc.lastDeviceID != "esp32_a1b2c3" {
		t.Fatalf("expected device_id esp32_a1b2c3, got %s", svc.lastDeviceID)
	}
}

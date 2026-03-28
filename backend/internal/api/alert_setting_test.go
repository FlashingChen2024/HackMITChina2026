package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type fakeAlertSettingService struct {
	lastUserID string
	lastInput  service.UpsertAlertSettingInput
	getValue   model.AlertSetting
	getErr     error
}

func (f *fakeAlertSettingService) UpsertAlertSetting(
	_ context.Context,
	userID string,
	input service.UpsertAlertSettingInput,
) error {
	f.lastUserID = userID
	f.lastInput = input
	return nil
}

func (f *fakeAlertSettingService) GetAlertSetting(_ context.Context, _ string) (model.AlertSetting, error) {
	if f.getErr != nil {
		return model.AlertSetting{}, f.getErr
	}
	return f.getValue, nil
}

func TestAlertSettingUpsertSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAlertSettingService{}
	handler := api.NewAlertSettingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/users/me/alert-setting", handler.Upsert)

	req := httptest.NewRequest(http.MethodPut, "/api/v1/users/me/alert-setting", bytes.NewBufferString(
		`{"email":"test@example.com","global_enabled":true,"rules":{"leftover":{"enabled":true,"max":20}}}`,
	))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", svc.lastUserID)
	}
	if !svc.lastInput.GlobalEnabled {
		t.Fatal("expected global_enabled true")
	}
	if string(svc.lastInput.RulesJSON) != `{"leftover":{"enabled":true,"max":20}}` {
		t.Fatalf("unexpected rules_json: %s", string(svc.lastInput.RulesJSON))
	}
}

func TestAlertSettingGetSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAlertSettingService{
		getValue: model.AlertSetting{
			UserID:        "user-1",
			Email:         "test@example.com",
			GlobalEnabled: true,
			RulesJSON:     datatypes.JSON([]byte(`{"leftover":{"enabled":true,"max":35}}`)),
		},
	}
	handler := api.NewAlertSettingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/alert-setting", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/alert-setting", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["global_enabled"] != true {
		t.Fatalf("expected global_enabled true, got %v", payload["global_enabled"])
	}
	rules, ok := payload["rules"].(map[string]any)
	if !ok {
		t.Fatalf("expected rules object, got %T", payload["rules"])
	}
	leftover, ok := rules["leftover"].(map[string]any)
	if !ok {
		t.Fatalf("expected rules.leftover object, got %T", rules["leftover"])
	}
	if leftover["max"] != float64(35) {
		t.Fatalf("expected leftover.max=35, got %v", leftover["max"])
	}
}

func TestAlertSettingGetNotFoundReturnsDefaultRules(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAlertSettingService{
		getErr: gorm.ErrRecordNotFound,
	}
	handler := api.NewAlertSettingHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/alert-setting", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/alert-setting", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	rules, ok := payload["rules"].(map[string]any)
	if !ok {
		t.Fatalf("expected rules object, got %T", payload["rules"])
	}
	leftover, ok := rules["leftover"].(map[string]any)
	if !ok {
		t.Fatalf("expected rules.leftover object, got %T", rules["leftover"])
	}
	if leftover["max"] != float64(50) {
		t.Fatalf("expected default leftover.max=50, got %v", leftover["max"])
	}
}

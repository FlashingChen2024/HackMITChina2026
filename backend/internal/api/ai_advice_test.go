package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type fakeAIAdviceService struct {
	result         service.AIAdviceResult
	err            error
	lastUserID     string
	lastAdviceType string
}

func (f *fakeAIAdviceService) GenerateAdvice(
	_ context.Context,
	userID string,
	adviceType string,
) (service.AIAdviceResult, error) {
	f.lastUserID = userID
	f.lastAdviceType = adviceType
	if f.err != nil {
		return service.AIAdviceResult{}, f.err
	}
	return f.result, nil
}

func TestAIAdviceSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAIAdviceService{
		result: service.AIAdviceResult{
			Type:    service.AdviceTypeMealReview,
			Advice:  "请多吃蔬菜",
			IsAlert: false,
			Prompt:  "prompt-demo",
		},
	}
	var logBuffer bytes.Buffer
	handler := api.NewAIAdviceHandler(svc, log.New(&logBuffer, "", 0))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/ai-advice", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice", nil)
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
	if payload["type"] != service.AdviceTypeMealReview {
		t.Fatalf("expected type meal_review, got %v", payload["type"])
	}
	if payload["advice"] != "请多吃蔬菜" {
		t.Fatalf("unexpected advice field: %v", payload["advice"])
	}
	if payload["is_alert"] != false {
		t.Fatalf("expected is_alert false, got %v", payload["is_alert"])
	}
	if payload["prompt"] != "prompt-demo" {
		t.Fatalf("expected prompt field to echo built prompt, got %v", payload["prompt"])
	}
	if !strings.Contains(logBuffer.String(), "[AI_PROMPT]") || !strings.Contains(logBuffer.String(), "prompt-demo") {
		t.Fatalf("expected prompt log output, got %q", logBuffer.String())
	}
}

func TestAIAdviceRejectsUnsupportedType(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAIAdviceService{err: service.ErrUnsupportedAdviceType}
	handler := api.NewAIAdviceHandler(svc, log.New(io.Discard, "", 0))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/ai-advice", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice?type=invalid", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestAIAdviceRequiresJWTContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewAIAdviceHandler(&fakeAIAdviceService{}, log.New(io.Discard, "", 0))
	router := gin.New()
	router.GET("/api/v1/users/me/ai-advice", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

func TestAIAdviceNoMealData(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAIAdviceService{err: service.ErrNoMealData}
	handler := api.NewAIAdviceHandler(svc, log.New(io.Discard, "", 0))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/ai-advice", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice?type=meal_review", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestAIAdviceUnavailable(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeAIAdviceService{err: service.ErrAIUnavailable}
	handler := api.NewAIAdviceHandler(svc, log.New(io.Discard, "", 0))

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/ai-advice", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/ai-advice", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusServiceUnavailable {
		t.Fatalf("expected status 503, got %d", resp.Code)
	}
}

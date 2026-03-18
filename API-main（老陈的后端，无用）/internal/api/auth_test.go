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
)

type fakeAuthService struct {
	registerUser model.User
	registerErr  error
	loginToken   string
	loginUser    model.User
	loginErr     error
}

func (f *fakeAuthService) Register(_ context.Context, _, _ string) (model.User, error) {
	if f.registerErr != nil {
		return model.User{}, f.registerErr
	}
	return f.registerUser, nil
}

func (f *fakeAuthService) Login(_ context.Context, _, _ string) (string, model.User, error) {
	if f.loginErr != nil {
		return "", model.User{}, f.loginErr
	}
	return f.loginToken, f.loginUser, nil
}

func TestRegisterSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewAuthHandler(&fakeAuthService{
		registerUser: model.User{ID: "user-1"},
	})
	router := gin.New()
	router.POST("/api/v1/auth/register", handler.Register)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register",
		bytes.NewBufferString(`{"username":"testuser","password":"testpass"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["user_id"] != "user-1" {
		t.Fatalf("expected user_id user-1, got %v", payload["user_id"])
	}
}

func TestRegisterDuplicateUser(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewAuthHandler(&fakeAuthService{
		registerErr: service.ErrUserExists,
	})
	router := gin.New()
	router.POST("/api/v1/auth/register", handler.Register)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/register",
		bytes.NewBufferString(`{"username":"testuser","password":"testpass"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusConflict {
		t.Fatalf("expected status 409, got %d", resp.Code)
	}
}

func TestLoginInvalidCredentials(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewAuthHandler(&fakeAuthService{
		loginErr: service.ErrInvalidCredentials,
	})
	router := gin.New()
	router.POST("/api/v1/auth/login", handler.Login)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		bytes.NewBufferString(`{"username":"testuser","password":"bad"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

func TestLoginSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewAuthHandler(&fakeAuthService{
		loginToken: "token-123",
		loginUser: model.User{
			ID:       "user-1",
			Username: "testuser",
		},
	})
	router := gin.New()
	router.POST("/api/v1/auth/login", handler.Login)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/auth/login",
		bytes.NewBufferString(`{"username":"testuser","password":"testpass"}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["token"] != "token-123" {
		t.Fatalf("expected token token-123, got %v", payload["token"])
	}
}

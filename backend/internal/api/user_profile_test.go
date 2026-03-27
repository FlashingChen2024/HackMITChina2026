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
	"gorm.io/gorm"
)

type fakeUserProfileService struct {
	lastUserID string
	lastInput  service.UpsertUserProfileInput
	profile    model.UserProfile
	upsertErr  error
	getErr     error
}

func (f *fakeUserProfileService) UpsertUserProfile(
	_ context.Context,
	userID string,
	input service.UpsertUserProfileInput,
) error {
	f.lastUserID = userID
	f.lastInput = input
	return f.upsertErr
}

func (f *fakeUserProfileService) GetUserProfile(_ context.Context, userID string) (model.UserProfile, error) {
	f.lastUserID = userID
	if f.getErr != nil {
		return model.UserProfile{}, f.getErr
	}
	return f.profile, nil
}

func TestUserProfileUpsertSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeUserProfileService{}
	handler := api.NewUserProfileHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/users/me/profile", handler.Upsert)

	req := httptest.NewRequest(
		http.MethodPut,
		"/api/v1/users/me/profile",
		bytes.NewBufferString(`{"height_cm":165,"weight_kg":45.0,"gender":"female","age":18}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", svc.lastUserID)
	}
	if svc.lastInput.HeightCM != 165 || svc.lastInput.WeightKG != 45.0 || svc.lastInput.Gender != "female" || svc.lastInput.Age != 18 {
		t.Fatalf("unexpected upsert input: %+v", svc.lastInput)
	}
}

func TestUserProfileGetNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeUserProfileService{getErr: gorm.ErrRecordNotFound}
	handler := api.NewUserProfileHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/profile", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/profile", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestUserProfileGetSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeUserProfileService{
		profile: model.UserProfile{
			UserID:   "user-1",
			HeightCM: 170,
			WeightKG: 68.5,
			Gender:   "male",
			Age:      25,
		},
	}
	handler := api.NewUserProfileHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/profile", handler.Get)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/users/me/profile", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	profile, ok := payload["profile"].(map[string]any)
	if !ok {
		t.Fatalf("expected profile object, got %v", payload["profile"])
	}
	if profile["user_id"] != "user-1" || profile["height_cm"] != float64(170) || profile["weight_kg"] != 68.5 || profile["gender"] != "male" || profile["age"] != float64(25) {
		t.Fatalf("unexpected profile payload: %v", profile)
	}
}

func TestUserProfileUpsertInvalidInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeUserProfileService{upsertErr: service.ErrInvalidInput}
	handler := api.NewUserProfileHandler(svc)

	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/users/me/profile", handler.Upsert)

	req := httptest.NewRequest(
		http.MethodPut,
		"/api/v1/users/me/profile",
		bytes.NewBufferString(`{"height_cm":0,"weight_kg":45.0,"gender":"female","age":18}`),
	)
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

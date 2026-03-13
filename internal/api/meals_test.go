package api_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type fakeMealQueryService struct {
	meals      []model.Meal
	trajectory []model.MealCurveData
	meal       model.Meal
	listErr    error
	detailErr  error
	trajErr    error
	lastCursor *time.Time
	lastTS     *time.Time
}

func (f *fakeMealQueryService) ListMeals(_ context.Context, cursor *time.Time) ([]model.Meal, error) {
	f.lastCursor = cursor
	return f.meals, f.listErr
}

func (f *fakeMealQueryService) GetMealByID(_ context.Context, _ string) (model.Meal, error) {
	if f.detailErr != nil {
		return model.Meal{}, f.detailErr
	}
	return f.meal, nil
}

func (f *fakeMealQueryService) GetMealTrajectory(_ context.Context, _ string, lastTimestamp *time.Time) ([]model.MealCurveData, error) {
	f.lastTS = lastTimestamp
	return f.trajectory, f.trajErr
}

func TestMealsListReturnsNextCursor(t *testing.T) {
	gin.SetMode(gin.TestMode)

	start := time.Date(2026, 3, 13, 8, 0, 0, 0, time.UTC)
	service := &fakeMealQueryService{
		meals: []model.Meal{
			{
				MealID:         "meal-1",
				StartTime:      start,
				TotalServedG:   500,
				TotalLeftoverG: 400,
			},
		},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.GET("/api/v1/meals", handler.List)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		NextCursor string `json:"next_cursor"`
		Items      []any  `json:"items"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(payload.Items) != 1 {
		t.Fatalf("expected 1 item, got %d", len(payload.Items))
	}
	if payload.NextCursor != start.Format(time.RFC3339) {
		t.Fatalf("expected next_cursor=%s, got %s", start.Format(time.RFC3339), payload.NextCursor)
	}
}

func TestMealsListRejectsInvalidCursor(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.GET("/api/v1/meals", handler.List)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals?cursor=bad-cursor", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestMealDetailNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{detailErr: gorm.ErrRecordNotFound}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.GET("/api/v1/meals/:meal_id", handler.GetByID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-missing", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestMealTrajectoryReturnsPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t1 := time.Date(2026, 3, 13, 10, 0, 0, 123000000, time.UTC)
	t2 := time.Date(2026, 3, 13, 10, 0, 5, 456000000, time.UTC)
	service := &fakeMealQueryService{
		trajectory: []model.MealCurveData{
			{MealID: "meal-1", Timestamp: t1, WeightG: 450},
			{MealID: "meal-1", Timestamp: t2, WeightG: 400},
		},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.GET("/api/v1/meals/:meal_id/trajectory", handler.Trajectory)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1/trajectory", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		LastTimestamp string `json:"last_timestamp"`
		Items         []any  `json:"items"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(payload.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(payload.Items))
	}
	if payload.LastTimestamp != t2.Format(time.RFC3339Nano) {
		t.Fatalf("expected last_timestamp=%s, got %s", t2.Format(time.RFC3339Nano), payload.LastTimestamp)
	}
}

func TestMealTrajectoryRejectsInvalidLastTimestamp(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewMealsHandler(&fakeMealQueryService{})
	router := gin.New()
	router.GET("/api/v1/meals/:meal_id/trajectory", handler.Trajectory)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1/trajectory?last_timestamp=bad", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestMealTrajectoryAcceptsRFC3339NanoLastTimestamp(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.GET("/api/v1/meals/:meal_id/trajectory", handler.Trajectory)

	last := time.Date(2026, 3, 13, 10, 0, 5, 456000000, time.UTC).Format(time.RFC3339Nano)
	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1/trajectory?last_timestamp="+last, nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if service.lastTS == nil {
		t.Fatalf("expected service to receive last timestamp")
	}
	if service.lastTS.UTC().Format(time.RFC3339Nano) != last {
		t.Fatalf("expected last_timestamp=%s, got %s", last, service.lastTS.UTC().Format(time.RFC3339Nano))
	}
}

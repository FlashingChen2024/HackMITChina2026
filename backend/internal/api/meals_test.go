package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type fakeMealQueryService struct {
	meals      []model.Meal
	trajectory []model.MealCurveData
	meal       model.Meal
	grids      []model.MealGrid
	statsRows  []model.DailyStatisticsRow

	listErr   error
	detailErr error
	trajErr   error
	attachErr error
	statsErr  error

	lastCursor           *time.Time
	lastListUserID       string
	lastDetailUserID     string
	lastDetailMealID     string
	lastTrajectoryUserID string
	lastTrajectoryMealID string
	lastAttachUserID     string
	lastTS               *time.Time
	lastAttachMeal       string
	lastAttachGrids      []model.MealGrid
	lastStatsUserID      string
	lastStatsStart       time.Time
	lastStatsEnd         time.Time
}

func (f *fakeMealQueryService) ListMeals(
	_ context.Context,
	userID string,
	cursor *time.Time,
) ([]model.Meal, error) {
	f.lastListUserID = userID
	f.lastCursor = cursor
	return f.meals, f.listErr
}

func (f *fakeMealQueryService) GetMealDetail(
	_ context.Context,
	userID string,
	mealID string,
) (model.Meal, []model.MealGrid, error) {
	f.lastDetailUserID = userID
	f.lastDetailMealID = mealID
	if f.detailErr != nil {
		return model.Meal{}, nil, f.detailErr
	}
	return f.meal, f.grids, nil
}

func (f *fakeMealQueryService) AttachFoods(
	_ context.Context,
	userID string,
	mealID string,
	grids []model.MealGrid,
) error {
	f.lastAttachUserID = userID
	f.lastAttachMeal = mealID
	f.lastAttachGrids = grids
	return f.attachErr
}

func (f *fakeMealQueryService) GetMealTrajectory(
	_ context.Context,
	userID string,
	mealID string,
	lastTimestamp *time.Time,
) ([]model.MealCurveData, error) {
	f.lastTrajectoryUserID = userID
	f.lastTrajectoryMealID = mealID
	f.lastTS = lastTimestamp
	return f.trajectory, f.trajErr
}

func (f *fakeMealQueryService) AggregateDailyStatistics(
	_ context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	f.lastStatsUserID = userID
	f.lastStatsStart = startDate
	f.lastStatsEnd = endDate
	return f.statsRows, f.statsErr
}

func TestMealsListReturnsNextCursor(t *testing.T) {
	gin.SetMode(gin.TestMode)

	start := time.Date(2026, 3, 13, 8, 0, 0, 0, time.UTC)
	service := &fakeMealQueryService{
		meals: []model.Meal{
			{
				MealID:    "meal-1",
				StartTime: start,
			},
		},
		meal:  model.Meal{MealID: "meal-1", StartTime: start},
		grids: []model.MealGrid{{MealID: "meal-1", GridIndex: 1, TotalCal: 174}},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
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
	if service.lastListUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", service.lastListUserID)
	}
}

func TestMealsListRejectsInvalidCursor(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
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
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/meals/:meal_id", handler.GetByID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-missing", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestMealDetailReturnsGridDetails(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{
		meal: model.Meal{
			MealID:          "meal-1",
			StartTime:       time.Date(2026, 3, 13, 10, 0, 0, 0, time.UTC),
			DurationMinutes: 25,
		},
		grids: []model.MealGrid{
			{MealID: "meal-1", GridIndex: 1, FoodName: "糙米饭", ServedG: 200, LeftoverG: 50, IntakeG: 150, TotalCal: 174},
		},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/meals/:meal_id", handler.GetByID)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		TotalMealCal float64 `json:"total_meal_cal"`
		GridDetails  []struct {
			GridIndex int     `json:"grid_index"`
			TotalCal  float64 `json:"total_cal"`
		} `json:"grid_details"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload.TotalMealCal != 174 {
		t.Fatalf("expected total_meal_cal=174, got %v", payload.TotalMealCal)
	}
	if len(payload.GridDetails) != 1 || payload.GridDetails[0].GridIndex != 1 {
		t.Fatalf("expected 1 grid detail with index=1")
	}
	if service.lastDetailUserID != "user-1" || service.lastDetailMealID != "meal-1" {
		t.Fatalf("expected detail query for user-1/meal-1, got %s/%s", service.lastDetailUserID, service.lastDetailMealID)
	}
}

func TestMealPutFoodsSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/meals/:meal_id/foods", handler.PutFoods)

	body := `{"grids":[{"grid_index":1,"food_name":"糙米饭","unit_cal_per_100g":116}]}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/meals/meal-1/foods", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if service.lastAttachMeal != "meal-1" {
		t.Fatalf("expected meal_id meal-1, got %s", service.lastAttachMeal)
	}
	if len(service.lastAttachGrids) != 1 || service.lastAttachGrids[0].GridIndex != 1 {
		t.Fatalf("expected one grid update forwarded")
	}
	if service.lastAttachUserID != "user-1" {
		t.Fatalf("expected attach user_id user-1, got %s", service.lastAttachUserID)
	}
}

func TestMealPutFoodsNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{attachErr: gorm.ErrRecordNotFound}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/meals/:meal_id/foods", handler.PutFoods)

	body := `{"grids":[{"grid_index":1,"food_name":"糙米饭","unit_cal_per_100g":116}]}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/meals/meal-1/foods", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestMealPutFoodsBadRequestOnInvalidServiceInput(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{attachErr: service.ErrInvalidInput}
	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.PUT("/api/v1/meals/:meal_id/foods", handler.PutFoods)

	body := `{"grids":[{"grid_index":1,"food_name":"糙米饭","unit_cal_per_100g":116}]}`
	req := httptest.NewRequest(http.MethodPut, "/api/v1/meals/meal-1/foods", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestMealTrajectoryReturnsPoints(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t1 := time.Date(2026, 3, 13, 10, 0, 0, 123000000, time.UTC)
	t2 := time.Date(2026, 3, 13, 10, 0, 5, 456000000, time.UTC)
	service := &fakeMealQueryService{
		trajectory: []model.MealCurveData{
			{MealID: "meal-1", Timestamp: t1, WeightG: 450, Grid1G: 120, Grid2G: 110, Grid3G: 100, Grid4G: 120},
			{MealID: "meal-1", Timestamp: t2, WeightG: 400, Grid1G: 100, Grid2G: 100, Grid3G: 90, Grid4G: 110},
		},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/meals/:meal_id/trajectory", handler.Trajectory)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/meals/meal-1/trajectory", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		LastTimestamp string `json:"last_timestamp"`
		Items         []struct {
			Timestamp string `json:"timestamp"`
			Weights   struct {
				Grid1 float64 `json:"grid_1"`
				Grid2 float64 `json:"grid_2"`
				Grid3 float64 `json:"grid_3"`
				Grid4 float64 `json:"grid_4"`
			} `json:"weights"`
		} `json:"items"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if len(payload.Items) != 2 {
		t.Fatalf("expected 2 items, got %d", len(payload.Items))
	}
	if payload.Items[0].Weights.Grid1 != 120 || payload.Items[0].Weights.Grid4 != 120 {
		t.Fatalf("expected first item grid weights to be returned, got %+v", payload.Items[0].Weights)
	}
	if payload.LastTimestamp != t2.Format(time.RFC3339Nano) {
		t.Fatalf("expected last_timestamp=%s, got %s", t2.Format(time.RFC3339Nano), payload.LastTimestamp)
	}
	if service.lastTrajectoryUserID != "user-1" || service.lastTrajectoryMealID != "meal-1" {
		t.Fatalf("expected trajectory query for user-1/meal-1, got %s/%s", service.lastTrajectoryUserID, service.lastTrajectoryMealID)
	}
}

func TestMealTrajectoryRejectsInvalidLastTimestamp(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewMealsHandler(&fakeMealQueryService{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
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
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
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

func TestMealStatisticsChartsReturnsColumnArraysAndZeroFill(t *testing.T) {
	gin.SetMode(gin.TestMode)

	service := &fakeMealQueryService{
		statsRows: []model.DailyStatisticsRow{
			{Date: "2026-03-01", DailyServedG: 600, DailyIntakeG: 500, DailyCalories: 750.5, AvgSpeedGPerMin: 15.2},
			{Date: "2026-03-03", DailyServedG: 700, DailyIntakeG: 680, DailyCalories: 910.0, AvgSpeedGPerMin: 18.5},
		},
	}

	handler := api.NewMealsHandler(service)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/statistics/charts", handler.StatisticsCharts)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/users/me/statistics/charts?start_date=2026-03-01&end_date=2026-03-03",
		nil,
	)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		UserID    string   `json:"user_id"`
		DateRange []string `json:"date_range"`
		ChartData struct {
			Dates           []string  `json:"dates"`
			DailyServedG    []float64 `json:"daily_served_g"`
			DailyIntakeG    []float64 `json:"daily_intake_g"`
			DailyCalories   []float64 `json:"daily_calories"`
			AvgSpeedGPerMin []float64 `json:"avg_speed_g_per_min"`
		} `json:"chart_data"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}

	if payload.UserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", payload.UserID)
	}
	if len(payload.DateRange) != 2 || payload.DateRange[0] != "2026-03-01" || payload.DateRange[1] != "2026-03-03" {
		t.Fatalf("unexpected date_range: %+v", payload.DateRange)
	}

	if len(payload.ChartData.Dates) != 3 ||
		len(payload.ChartData.DailyServedG) != 3 ||
		len(payload.ChartData.DailyIntakeG) != 3 ||
		len(payload.ChartData.DailyCalories) != 3 ||
		len(payload.ChartData.AvgSpeedGPerMin) != 3 {
		t.Fatalf("expected all chart arrays length 3")
	}

	if payload.ChartData.Dates[0] != "03-01" || payload.ChartData.Dates[1] != "03-02" || payload.ChartData.Dates[2] != "03-03" {
		t.Fatalf("unexpected dates: %+v", payload.ChartData.Dates)
	}
	if payload.ChartData.DailyServedG[1] != 0 ||
		payload.ChartData.DailyIntakeG[1] != 0 ||
		payload.ChartData.DailyCalories[1] != 0 ||
		payload.ChartData.AvgSpeedGPerMin[1] != 0 {
		t.Fatalf("expected zero-fill for missing day, got served=%v intake=%v calories=%v speed=%v",
			payload.ChartData.DailyServedG[1],
			payload.ChartData.DailyIntakeG[1],
			payload.ChartData.DailyCalories[1],
			payload.ChartData.AvgSpeedGPerMin[1],
		)
	}

	if service.lastStatsUserID != "user-1" {
		t.Fatalf("expected service user_id user-1, got %s", service.lastStatsUserID)
	}
	if service.lastStatsStart.Format("2006-01-02") != "2026-03-01" || service.lastStatsEnd.Format("2006-01-02") != "2026-03-03" {
		t.Fatalf("unexpected service date range: %s - %s", service.lastStatsStart, service.lastStatsEnd)
	}
}

func TestMealStatisticsChartsRejectsBadDateRange(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewMealsHandler(&fakeMealQueryService{})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.GET("/api/v1/users/me/statistics/charts", handler.StatisticsCharts)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/users/me/statistics/charts?start_date=bad&end_date=2026-03-03",
		nil,
	)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestMealStatisticsChartsRequiresJWTContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewMealsHandler(&fakeMealQueryService{})
	router := gin.New()
	router.GET("/api/v1/users/me/statistics/charts", handler.StatisticsCharts)

	req := httptest.NewRequest(
		http.MethodGet,
		"/api/v1/users/me/statistics/charts?start_date=2026-03-01&end_date=2026-03-03",
		nil,
	)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

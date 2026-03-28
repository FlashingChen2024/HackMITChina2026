package api_test

import (
	"bytes"
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type fakeVisionConfirmMealService struct {
	attachErr       error
	lastUserID      string
	lastMealID      string
	lastAttachGrids []model.MealGrid
}

func (f *fakeVisionConfirmMealService) AttachFoods(
	_ context.Context,
	userID string,
	mealID string,
	grids []model.MealGrid,
) error {
	f.lastUserID = userID
	f.lastMealID = mealID
	f.lastAttachGrids = grids
	return f.attachErr
}

type fakeVisionConfirmFoodLibrary struct {
	items map[string]service.FoodLibraryItem
}

func (f *fakeVisionConfirmFoodLibrary) FindByCode(_ context.Context, foodCode string) (service.FoodLibraryItem, error) {
	item, ok := f.items[foodCode]
	if !ok {
		return service.FoodLibraryItem{}, service.ErrFoodNotFound
	}
	return item, nil
}

func TestVisionConfirmSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mealSvc := &fakeVisionConfirmMealService{}
	library := &fakeVisionConfirmFoodLibrary{
		items: map[string]service.FoodLibraryItem{
			"FD001": {
				FoodCode:              "FD001",
				FoodNameCN:            "炸鸡",
				DefaultUnitCalPer100G: 260,
			},
		},
	}
	handler := api.NewVisionConfirmHandler(mealSvc, library)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/meals/:meal_id/vision-confirm", handler.Confirm)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/meals/meal-1/vision-confirm", bytes.NewBufferString(`{"grids":[{"grid_index":1,"food_code":"FD001"}]}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if mealSvc.lastUserID != "user-1" {
		t.Fatalf("expected user_id=user-1, got %s", mealSvc.lastUserID)
	}
	if mealSvc.lastMealID != "meal-1" {
		t.Fatalf("expected meal_id=meal-1, got %s", mealSvc.lastMealID)
	}
	if len(mealSvc.lastAttachGrids) != 1 {
		t.Fatalf("expected 1 grid, got %d", len(mealSvc.lastAttachGrids))
	}
	if mealSvc.lastAttachGrids[0].FoodName != "炸鸡" || mealSvc.lastAttachGrids[0].UnitCalPer100G != 260 {
		t.Fatalf("unexpected mapped grid: %+v", mealSvc.lastAttachGrids[0])
	}
}

func TestVisionConfirmFoodCodeNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewVisionConfirmHandler(&fakeVisionConfirmMealService{}, &fakeVisionConfirmFoodLibrary{
		items: map[string]service.FoodLibraryItem{},
	})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/meals/:meal_id/vision-confirm", handler.Confirm)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/meals/meal-1/vision-confirm", bytes.NewBufferString(`{"grids":[{"grid_index":1,"food_code":"FD999"}]}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestVisionConfirmMapsMealNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mealSvc := &fakeVisionConfirmMealService{attachErr: gorm.ErrRecordNotFound}
	handler := api.NewVisionConfirmHandler(mealSvc, &fakeVisionConfirmFoodLibrary{
		items: map[string]service.FoodLibraryItem{
			"FD001": {FoodCode: "FD001", FoodNameCN: "炸鸡", DefaultUnitCalPer100G: 260},
		},
	})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/meals/:meal_id/vision-confirm", handler.Confirm)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/meals/meal-missing/vision-confirm", bytes.NewBufferString(`{"grids":[{"grid_index":1,"food_code":"FD001"}]}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestVisionConfirmMapsUnexpectedError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	mealSvc := &fakeVisionConfirmMealService{attachErr: errors.New("db error")}
	handler := api.NewVisionConfirmHandler(mealSvc, &fakeVisionConfirmFoodLibrary{
		items: map[string]service.FoodLibraryItem{
			"FD001": {FoodCode: "FD001", FoodNameCN: "炸鸡", DefaultUnitCalPer100G: 260},
		},
	})
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/meals/:meal_id/vision-confirm", handler.Confirm)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/meals/meal-1/vision-confirm", bytes.NewBufferString(`{"grids":[{"grid_index":1,"food_code":"FD001"}]}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", resp.Code)
	}
}

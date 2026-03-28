package api_test

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type fakeFoodLibraryService struct {
	searchResp  []service.FoodLibraryItem
	searchErr   error
	lastKeyword string
}

func (f *fakeFoodLibraryService) Search(_ context.Context, keyword string) ([]service.FoodLibraryItem, error) {
	f.lastKeyword = keyword
	if f.searchErr != nil {
		return nil, f.searchErr
	}
	return f.searchResp, nil
}

func TestFoodLibrarySearchSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeFoodLibraryService{
		searchResp: []service.FoodLibraryItem{
			{
				FoodCode:              "FD001",
				FoodNameCN:            "炸鸡",
				DefaultUnitCalPer100G: 260.0,
			},
		},
	}
	handler := api.NewFoodLibraryHandler(svc)
	router := gin.New()
	router.GET("/api/v1/food-library/search", handler.Search)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/food-library/search?keyword=%E7%82%B8%E9%B8%A1", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if svc.lastKeyword != "炸鸡" {
		t.Fatalf("expected keyword 炸鸡, got %s", svc.lastKeyword)
	}
}

func TestFoodLibrarySearchRequiresKeyword(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewFoodLibraryHandler(&fakeFoodLibraryService{})
	router := gin.New()
	router.GET("/api/v1/food-library/search", handler.Search)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/food-library/search", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestFoodLibrarySearchServerError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewFoodLibraryHandler(&fakeFoodLibraryService{searchErr: errors.New("db down")})
	router := gin.New()
	router.GET("/api/v1/food-library/search", handler.Search)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/food-library/search?keyword=%E7%82%B8%E9%B8%A1", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500, got %d", resp.Code)
	}
}

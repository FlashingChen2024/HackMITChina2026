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

type fakeCommunityService struct {
	createResp   model.Community
	createErr    error
	joinErr      error
	dashboard    service.CommunityDashboard
	dashboardErr error

	lastCreateUserID string
	lastCreateName   string
	lastCreateDesc   string
	lastJoinID       string
	lastJoinUserID   string
	lastDashboardID  string
}

func (f *fakeCommunityService) CreateCommunity(
	_ context.Context,
	userID string,
	name string,
	description string,
) (model.Community, error) {
	f.lastCreateUserID = userID
	f.lastCreateName = name
	f.lastCreateDesc = description
	if f.createErr != nil {
		return model.Community{}, f.createErr
	}
	return f.createResp, nil
}

func (f *fakeCommunityService) JoinCommunity(_ context.Context, communityID string, userID string) error {
	f.lastJoinID = communityID
	f.lastJoinUserID = userID
	return f.joinErr
}

func (f *fakeCommunityService) GetDashboard(_ context.Context, communityID string) (service.CommunityDashboard, error) {
	f.lastDashboardID = communityID
	if f.dashboardErr != nil {
		return service.CommunityDashboard{}, f.dashboardErr
	}
	return f.dashboard, nil
}

func TestCommunityCreateSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeCommunityService{
		createResp: model.Community{CommunityID: "community-1"},
	}
	handler := api.NewCommunityHandler(svc)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-1")
		c.Next()
	})
	router.POST("/api/v1/communities/create", handler.Create)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/communities/create",
		bytes.NewBufferString(`{"name":"MIT 黑客松健康营","description":"健康饮食社区"}`))
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
	if payload["community_id"] != "community-1" {
		t.Fatalf("expected community_id=community-1, got %v", payload["community_id"])
	}
	if payload["message"] != "创建成功" {
		t.Fatalf("expected message=创建成功, got %v", payload["message"])
	}
	if svc.lastCreateUserID != "user-1" {
		t.Fatalf("expected user_id=user-1, got %s", svc.lastCreateUserID)
	}
}

func TestCommunityJoinNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeCommunityService{joinErr: gorm.ErrRecordNotFound}
	handler := api.NewCommunityHandler(svc)
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set("user_id", "user-2")
		c.Next()
	})
	router.POST("/api/v1/communities/:community_id/join", handler.Join)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/communities/community-missing/join", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", resp.Code)
	}
}

func TestCommunityDashboardSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	svc := &fakeCommunityService{
		dashboard: service.CommunityDashboard{
			CommunityID:   "community-1",
			CommunityName: "MIT 黑客松健康营",
			MemberCount:   3,
			FoodAvgStats: []model.CommunityFoodAvgStat{
				{
					FoodName:        "西红柿炒鸡蛋",
					AvgServedG:      180.5,
					AvgLeftoverG:    30.0,
					AvgIntakeG:      150.5,
					AvgSpeedGPerMin: 12.5,
				},
			},
		},
	}
	handler := api.NewCommunityHandler(svc)
	router := gin.New()
	router.GET("/api/v1/communities/:community_id/dashboard", handler.Dashboard)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/communities/community-1/dashboard", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		CommunityID string `json:"community_id"`
		MemberCount int64  `json:"member_count"`
		FoodStats   []struct {
			FoodName string `json:"food_name"`
		} `json:"food_avg_stats"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload.CommunityID != "community-1" {
		t.Fatalf("expected community_id=community-1, got %s", payload.CommunityID)
	}
	if payload.MemberCount != 3 {
		t.Fatalf("expected member_count=3, got %d", payload.MemberCount)
	}
	if len(payload.FoodStats) != 1 || payload.FoodStats[0].FoodName != "西红柿炒鸡蛋" {
		t.Fatalf("expected one food stats row")
	}
}

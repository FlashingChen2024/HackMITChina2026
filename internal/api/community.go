package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type CommunityService interface {
	CreateCommunity(ctx context.Context, userID string, name string, description string) (model.Community, error)
	JoinCommunity(ctx context.Context, communityID string, userID string) error
	GetDashboard(ctx context.Context, communityID string) (service.CommunityDashboard, error)
	ListUserCommunities(ctx context.Context, userID string) ([]service.UserCommunity, error)
}

type CommunityHandler struct {
	service CommunityService
}

type createCommunityRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
}

type dashboardFoodAvgStatResponse struct {
	FoodName        string  `json:"food_name"`
	AvgServedG      float64 `json:"avg_served_g"`
	AvgLeftoverG    float64 `json:"avg_leftover_g"`
	AvgIntakeG      float64 `json:"avg_intake_g"`
	AvgSpeedGPerMin float64 `json:"avg_speed_g_per_min"`
}

type userCommunityItemResponse struct {
	CommunityID string `json:"community_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	MemberCount int64  `json:"member_count"`
}

func NewCommunityHandler(service CommunityService) *CommunityHandler {
	return &CommunityHandler{service: service}
}

func (h *CommunityHandler) Create(c *gin.Context) {
	var req createCommunityRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	community, err := h.service.CreateCommunity(c.Request.Context(), userID, req.Name, req.Description)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "name is required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "create community failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"community_id": community.CommunityID,
		"message":      "创建成功",
	})
}

func (h *CommunityHandler) Join(c *gin.Context) {
	communityID := strings.TrimSpace(c.Param("community_id"))
	if communityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "community_id is required"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	if err := h.service.JoinCommunity(c.Request.Context(), communityID, userID); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "community_id is required"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "community not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "join community failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "加入成功"})
}

func (h *CommunityHandler) Dashboard(c *gin.Context) {
	communityID := strings.TrimSpace(c.Param("community_id"))
	if communityID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "community_id is required"})
		return
	}

	dashboard, err := h.service.GetDashboard(c.Request.Context(), communityID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "community_id is required"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "community not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "get dashboard failed"})
		}
		return
	}

	stats := make([]dashboardFoodAvgStatResponse, 0, len(dashboard.FoodAvgStats))
	for _, item := range dashboard.FoodAvgStats {
		stats = append(stats, dashboardFoodAvgStatResponse{
			FoodName:        item.FoodName,
			AvgServedG:      item.AvgServedG,
			AvgLeftoverG:    item.AvgLeftoverG,
			AvgIntakeG:      item.AvgIntakeG,
			AvgSpeedGPerMin: item.AvgSpeedGPerMin,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"community_id":   dashboard.CommunityID,
		"community_name": dashboard.CommunityName,
		"member_count":   dashboard.MemberCount,
		"food_avg_stats": stats,
	})
}

func (h *CommunityHandler) List(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	communities, err := h.service.ListUserCommunities(c.Request.Context(), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "user_id is required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "list communities failed"})
		}
		return
	}

	items := make([]userCommunityItemResponse, 0, len(communities))
	for _, item := range communities {
		items = append(items, userCommunityItemResponse{
			CommunityID: item.CommunityID,
			Name:        item.Name,
			Description: item.Description,
			MemberCount: item.MemberCount,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"items": items,
	})
}

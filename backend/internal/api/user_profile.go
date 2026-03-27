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

type UserProfileService interface {
	UpsertUserProfile(ctx context.Context, userID string, input service.UpsertUserProfileInput) error
	GetUserProfile(ctx context.Context, userID string) (model.UserProfile, error)
}

type UserProfileHandler struct {
	service UserProfileService
}

type upsertUserProfileRequest struct {
	HeightCM int     `json:"height_cm" binding:"required"`
	WeightKG float64 `json:"weight_kg" binding:"required"`
	Gender   string  `json:"gender" binding:"required"`
	Age      int     `json:"age" binding:"required"`
}

func NewUserProfileHandler(service UserProfileService) *UserProfileHandler {
	return &UserProfileHandler{service: service}
}

func (h *UserProfileHandler) Upsert(c *gin.Context) {
	var req upsertUserProfileRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求体"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	err := h.service.UpsertUserProfile(c.Request.Context(), userID, service.UpsertUserProfileInput{
		HeightCM: req.HeightCM,
		WeightKG: req.WeightKG,
		Gender:   req.Gender,
		Age:      req.Age,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "height_cm、weight_kg、gender、age 都必须为有效值"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存用户画像失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "用户画像保存成功",
		"profile": gin.H{
			"user_id":   userID,
			"height_cm": req.HeightCM,
			"weight_kg": req.WeightKG,
			"gender":    strings.TrimSpace(req.Gender),
			"age":       req.Age,
		},
	})
}

func (h *UserProfileHandler) Get(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	profile, err := h.service.GetUserProfile(c.Request.Context(), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID无效"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "用户画像不存在"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询用户画像失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"profile": gin.H{
			"user_id":   profile.UserID,
			"height_cm": profile.HeightCM,
			"weight_kg": profile.WeightKG,
			"gender":    profile.Gender,
			"age":       profile.Age,
		},
	})
}

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

type AlertSettingService interface {
	UpsertAlertSetting(ctx context.Context, userID string, input service.UpsertAlertSettingInput) error
	GetAlertSetting(ctx context.Context, userID string) (model.AlertSetting, error)
}

type AlertSettingHandler struct {
	service AlertSettingService
}

type upsertAlertSettingRequest struct {
	Email   string `json:"email"`
	Enabled bool   `json:"enabled"`
}

func NewAlertSettingHandler(service AlertSettingService) *AlertSettingHandler {
	return &AlertSettingHandler{service: service}
}

func (h *AlertSettingHandler) Upsert(c *gin.Context) {
	var req upsertAlertSettingRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求体"})
		return
	}

	email := strings.TrimSpace(req.Email)
	if email == "" && req.Enabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "启用告警时必须填写邮箱地址"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	err := h.service.UpsertAlertSetting(c.Request.Context(), userID, service.UpsertAlertSettingInput{
		Email:   email,
		Enabled: req.Enabled,
	})
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID无效"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "保存告警设置失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "告警设置保存成功",
		"alert_setting": gin.H{
			"user_id": userID,
			"email":   email,
			"enabled": req.Enabled,
		},
	})
}

func (h *AlertSettingHandler) Get(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	setting, err := h.service.GetAlertSetting(c.Request.Context(), userID)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID无效"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "告警设置不存在"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询告警设置失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"alert_setting": gin.H{
			"user_id": setting.UserID,
			"email":   setting.Email,
			"enabled": setting.Enabled,
		},
	})
}

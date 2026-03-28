package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/datatypes"
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
	Email         string          `json:"email"`
	GlobalEnabled bool            `json:"global_enabled"`
	Rules         json.RawMessage `json:"rules"`
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
	if email == "" && req.GlobalEnabled {
		c.JSON(http.StatusBadRequest, gin.H{"error": "启用告警时必须填写邮箱地址"})
		return
	}
	rules := normalizeRulesRawMessage(req.Rules)
	if !json.Valid(rules) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "rules 必须是合法 JSON"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	err := h.service.UpsertAlertSetting(c.Request.Context(), userID, service.UpsertAlertSettingInput{
		Email:         email,
		GlobalEnabled: req.GlobalEnabled,
		RulesJSON:     datatypes.JSON(rules),
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
		"message":        "告警规则配置保存成功",
		"user_id":        userID,
		"email":          email,
		"global_enabled": req.GlobalEnabled,
		"rules":          rules,
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
			defaultSetting := defaultAlertSetting(userID)
			c.JSON(http.StatusOK, gin.H{
				"user_id":        defaultSetting.UserID,
				"email":          defaultSetting.Email,
				"global_enabled": defaultSetting.GlobalEnabled,
				"rules":          normalizeRulesRawMessage(defaultSetting.RulesJSON),
			})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "查询告警设置失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id":        setting.UserID,
		"email":          setting.Email,
		"global_enabled": setting.GlobalEnabled,
		"rules":          normalizeRulesRawMessage(setting.RulesJSON),
	})
}

func normalizeRulesRawMessage(raw []byte) json.RawMessage {
	if len(raw) == 0 {
		return json.RawMessage([]byte(`{}`))
	}
	return json.RawMessage(raw)
}

func defaultAlertSetting(userID string) model.AlertSetting {
	return model.AlertSetting{
		UserID:        userID,
		Email:         "",
		GlobalEnabled: false,
		RulesJSON: datatypes.JSON([]byte(`{
			"duration":{"enabled":true,"min":10.0,"max":40.0},
			"speed":{"enabled":true,"min":5.0,"max":25.0},
			"intake":{"enabled":false,"min":200.0,"max":800.0},
			"leftover":{"enabled":true,"min":0.0,"max":50.0},
			"calories":{"enabled":true,"min":300.0,"max":1000.0},
			"meal_times":{
				"enabled":true,
				"breakfast":{"start":"07:00","end":"09:30"},
				"lunch":{"start":"11:30","end":"13:30"},
				"dinner":{"start":"17:30","end":"20:00"}
			}
		}`)),
	}
}

package api

import (
	"context"
	"net/http"
	"strings"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type DeviceBindingService interface {
	BindDevice(ctx context.Context, userID string, deviceID string) error
	ListDevices(ctx context.Context, userID string) ([]string, error)
	UnbindDevice(ctx context.Context, userID string, deviceID string) error
}

type DeviceBindingHandler struct {
	service DeviceBindingService
}

type bindDeviceRequest struct {
	DeviceID string `json:"device_id" binding:"required"`
}

func NewDeviceBindingHandler(service DeviceBindingService) *DeviceBindingHandler {
	return &DeviceBindingHandler{service: service}
}

func (h *DeviceBindingHandler) Bind(c *gin.Context) {
	var req bindDeviceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "无效的请求体"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	if err := h.service.BindDevice(c.Request.Context(), userID, req.DeviceID); err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "设备ID是必填项"})
		case service.ErrDeviceBoundToAnother:
			c.JSON(http.StatusConflict, gin.H{"error": "设备已绑定到其他用户"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "绑定设备失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "device bind success",
		"device_id": strings.ToUpper(strings.TrimSpace(req.DeviceID)),
	})
}

func (h *DeviceBindingHandler) List(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的令牌上下文"})
		return
	}

	devices, err := h.service.ListDevices(c.Request.Context(), userID)
	if err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "用户ID是必填项"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "获取设备列表失败"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"devices": devices,
	})
}

func (h *DeviceBindingHandler) Unbind(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	deviceID := strings.TrimSpace(c.Param("device_id"))
	if err := h.service.UnbindDevice(c.Request.Context(), userID, deviceID); err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		case service.ErrDeviceForbidden:
			c.JSON(http.StatusForbidden, gin.H{"error": "forbidden to unbind this device"})
		case service.ErrDeviceNotBound:
			c.JSON(http.StatusNotFound, gin.H{"error": "device not bound"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "unbind device failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "device unbind success",
		"device_id": strings.ToUpper(deviceID),
	})
}

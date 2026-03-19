package api

import (
	"context"
	"net/http"
	"strings"
	"time"

	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type DeviceBindingService interface {
	BindDevice(ctx context.Context, userID string, deviceID string) error
	ListByUserID(ctx context.Context, userID string) ([]model.DeviceBinding, error)
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
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	if err := h.service.BindDevice(c.Request.Context(), userID, req.DeviceID); err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		case service.ErrDeviceBoundToAnother:
			c.JSON(http.StatusConflict, gin.H{"error": "device already bound to another user"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "bind device failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":   "device bind success",
		"device_id": strings.ToUpper(strings.TrimSpace(req.DeviceID)),
	})
}

// v4.2：GET /devices
func (h *DeviceBindingHandler) List(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	bindings, err := h.service.ListByUserID(c.Request.Context(), userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list devices failed"})
		return
	}

	items := make([]gin.H, 0, len(bindings))
	for _, b := range bindings {
		items = append(items, gin.H{
			"device_id": b.DeviceID,
			"bind_time": b.CreatedAt.UTC().Format(time.RFC3339),
			"status":    "online",
		})
	}

	c.JSON(http.StatusOK, gin.H{"items": items})
}

// v4.2：DELETE /devices/{device_id}
func (h *DeviceBindingHandler) Unbind(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	deviceID := strings.TrimSpace(c.Param("device_id"))
	if userID == "" || deviceID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id or device_id missing"})
		return
	}

	if err := h.service.UnbindDevice(c.Request.Context(), userID, deviceID); err != nil {
		switch err {
		case service.ErrDeviceBoundToAnother:
			c.JSON(http.StatusForbidden, gin.H{"error": "无权解绑他人的设备"})
		case service.ErrDeviceNotBound:
			c.JSON(http.StatusNotFound, gin.H{"error": "device not found"})
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid input"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "unbind device failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "解绑成功，设备已重置",
		"device_id":  strings.ToUpper(deviceID),
	})
}

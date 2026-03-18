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

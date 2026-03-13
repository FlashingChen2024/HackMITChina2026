package api

import (
	"net/http"
	"strconv"
	"time"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type TelemetryHandler struct {
	telemetryService *service.TelemetryService
}

type telemetryRequest struct {
	DeviceID  string `json:"device_id" binding:"required"`
	WeightG   *int   `json:"weight_g" binding:"required"`
	Timestamp string `json:"timestamp"`
}

func NewTelemetryHandler(telemetryService *service.TelemetryService) *TelemetryHandler {
	return &TelemetryHandler{telemetryService: telemetryService}
}

func (h *TelemetryHandler) Handle(c *gin.Context) {
	var req telemetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	ts, err := parseTimestamp(req.Timestamp)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "timestamp must be RFC3339 or unix seconds"})
		return
	}

	result, err := h.telemetryService.Process(c.Request.Context(), service.TelemetryInput{
		DeviceID:  req.DeviceID,
		WeightG:   *req.WeightG,
		Timestamp: ts,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "process telemetry failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"device_id":      result.DeviceID,
		"previous_state": result.PreviousState,
		"current_state":  result.CurrentState,
		"timestamp":      ts.UTC().Format(time.RFC3339),
	})
}

func parseTimestamp(raw string) (time.Time, error) {
	if raw == "" {
		return time.Now().UTC(), nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC(), nil
	}
	if unix, err := strconv.ParseInt(raw, 10, 64); err == nil {
		return time.Unix(unix, 0).UTC(), nil
	}
	return time.Time{}, strconv.ErrSyntax
}

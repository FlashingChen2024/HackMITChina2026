package api

import (
	"context"
	"errors"
	"math"
	"net/http"
	"strconv"
	"time"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type TelemetryHandler struct {
	telemetryService *service.TelemetryService
	bindingService   TelemetryBindingResolver
}

type TelemetryBindingResolver interface {
	ResolveUserID(ctx context.Context, deviceID string) (string, error)
}

type telemetryWeights struct {
	Grid1 *float64 `json:"grid_1" binding:"required"`
	Grid2 *float64 `json:"grid_2" binding:"required"`
	Grid3 *float64 `json:"grid_3" binding:"required"`
	Grid4 *float64 `json:"grid_4" binding:"required"`
}

type telemetryRequest struct {
	DeviceID  string           `json:"device_id" binding:"required"`
	Weights   telemetryWeights `json:"weights" binding:"required"`
	Timestamp string           `json:"timestamp"`
}

var errInvalidWeights = errors.New("weights must be non-negative")

func NewTelemetryHandler(
	telemetryService *service.TelemetryService,
	bindingService TelemetryBindingResolver,
) *TelemetryHandler {
	return &TelemetryHandler{
		telemetryService: telemetryService,
		bindingService:   bindingService,
	}
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

	gridWeights, err := gridWeightsFromRequest(req.Weights)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	totalWeight := gridWeights[0] + gridWeights[1] + gridWeights[2] + gridWeights[3]

	userID, err := h.bindingService.ResolveUserID(c.Request.Context(), req.DeviceID)
	if err != nil {
		switch err {
		case service.ErrDeviceNotBound:
			c.Status(http.StatusOK)
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "device_id is required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "resolve device binding failed"})
		}
		return
	}

	result, err := h.telemetryService.Process(c.Request.Context(), service.TelemetryInput{
		DeviceID:    req.DeviceID,
		UserID:      userID,
		WeightG:     totalWeight,
		GridWeights: gridWeights,
		Timestamp:   ts,
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

func gridWeightsFromRequest(weights telemetryWeights) ([4]int, error) {
	raw := []*float64{weights.Grid1, weights.Grid2, weights.Grid3, weights.Grid4}
	var grids [4]int
	for i, value := range raw {
		if value == nil || *value < 0 {
			return [4]int{}, errInvalidWeights
		}
		grids[i] = int(math.Round(*value))
	}
	return grids, nil
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

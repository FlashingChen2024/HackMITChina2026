package api

import (
	"context"
	"log"
	"net/http"
	"strings"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type AIAdviceService interface {
	GenerateAdvice(ctx context.Context, userID string, adviceType string) (service.AIAdviceResult, error)
}

type AIAdviceHandler struct {
	service AIAdviceService
	logger  *log.Logger
}

func NewAIAdviceHandler(service AIAdviceService, logger *log.Logger) *AIAdviceHandler {
	if logger == nil {
		logger = log.Default()
	}
	return &AIAdviceHandler{
		service: service,
		logger:  logger,
	}
}

func (h *AIAdviceHandler) Get(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	adviceType := strings.TrimSpace(c.Query("type"))
	result, err := h.service.GenerateAdvice(c.Request.Context(), userID, adviceType)
	if err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		case service.ErrUnsupportedAdviceType:
			c.JSON(http.StatusBadRequest, gin.H{"error": "type must be one of: meal_review,daily_alert,next_meal"})
		case service.ErrNoMealData:
			c.JSON(http.StatusNotFound, gin.H{"error": "no meal data for user"})
		case service.ErrAIUnavailable:
			c.JSON(http.StatusServiceUnavailable, gin.H{"error": "ai service unavailable"})
		case service.ErrAIResponseInvalid:
			c.JSON(http.StatusBadGateway, gin.H{"error": "invalid ai response"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "generate ai advice failed"})
		}
		return
	}

	h.logger.Printf("[AI_PROMPT] user_id=%s type=%s prompt=%s", userID, result.Type, result.Prompt)

	c.JSON(http.StatusOK, gin.H{
		"type":     result.Type,
		"advice":   result.Advice,
		"is_alert": result.IsAlert,
		"prompt":   result.Prompt,
	})
}

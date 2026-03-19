package api

import (
	"net/http"
	"strings"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type aiAdviceHandler struct {
	service *service.AiAdviceService
}

func NewAiAdviceHandler(svc *service.AiAdviceService) *aiAdviceHandler {
	return &aiAdviceHandler{service: svc}
}

func (h *aiAdviceHandler) GetMeAiAdvice(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid token context"})
		return
	}

	adviceType := strings.TrimSpace(c.Query("type"))
	if adviceType == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "type is required"})
		return
	}

	result, err := h.service.GetMeAiAdvice(c.Request.Context(), userID, adviceType)
	if err != nil {
		if err == service.ErrInvalidInput {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid type"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get ai advice failed"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"type":     result.Type,
		"advice":   result.Advice,
		"is_alert": result.IsAlert,
	})
}


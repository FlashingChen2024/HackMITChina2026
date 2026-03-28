package api

import (
	"context"
	"errors"
	"net/http"
	"strings"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type FoodLibraryService interface {
	Search(ctx context.Context, keyword string) ([]service.FoodLibraryItem, error)
}

type FoodLibraryHandler struct {
	service FoodLibraryService
}

type foodLibraryMatchResponse struct {
	FoodCode              string  `json:"food_code"`
	FoodNameCN            string  `json:"food_name_cn"`
	DefaultUnitCalPer100G float64 `json:"default_unit_cal_per_100g"`
}

func NewFoodLibraryHandler(service FoodLibraryService) *FoodLibraryHandler {
	return &FoodLibraryHandler{service: service}
}

func (h *FoodLibraryHandler) Search(c *gin.Context) {
	keyword := strings.TrimSpace(c.Query("keyword"))
	if keyword == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "keyword is required"})
		return
	}

	matches, err := h.service.Search(c.Request.Context(), keyword)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "keyword is required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "search food library failed"})
		}
		return
	}

	items := make([]foodLibraryMatchResponse, 0, len(matches))
	for _, item := range matches {
		items = append(items, foodLibraryMatchResponse{
			FoodCode:              item.FoodCode,
			FoodNameCN:            item.FoodNameCN,
			DefaultUnitCalPer100G: item.DefaultUnitCalPer100G,
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"keyword": keyword,
		"matches": items,
	})
}

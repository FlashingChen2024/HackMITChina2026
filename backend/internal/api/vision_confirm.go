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

type VisionConfirmMealService interface {
	AttachFoods(ctx context.Context, userID string, mealID string, grids []model.MealGrid) error
}

type VisionConfirmFoodLibrary interface {
	FindByCode(ctx context.Context, foodCode string) (service.FoodLibraryItem, error)
}

type VisionConfirmHandler struct {
	mealService VisionConfirmMealService
	foodLibrary VisionConfirmFoodLibrary
}

type visionConfirmRequest struct {
	Grids []visionConfirmGridRequest `json:"grids" binding:"required"`
}

type visionConfirmGridRequest struct {
	GridIndex int    `json:"grid_index"`
	FoodCode  string `json:"food_code"`
}

func NewVisionConfirmHandler(
	mealService VisionConfirmMealService,
	foodLibrary VisionConfirmFoodLibrary,
) *VisionConfirmHandler {
	return &VisionConfirmHandler{
		mealService: mealService,
		foodLibrary: foodLibrary,
	}
}

func (h *VisionConfirmHandler) Confirm(c *gin.Context) {
	userID := strings.TrimSpace(c.GetString("user_id"))
	if userID == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	mealID := strings.TrimSpace(c.Param("meal_id"))
	if mealID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "meal_id is required"})
		return
	}

	var req visionConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.Grids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "grids is required"})
		return
	}

	grids := make([]model.MealGrid, 0, len(req.Grids))
	seenGrid := make(map[int]struct{}, len(req.Grids))
	for _, grid := range req.Grids {
		if grid.GridIndex < 1 || grid.GridIndex > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "grid_index must be in [1,4]"})
			return
		}
		if _, ok := seenGrid[grid.GridIndex]; ok {
			c.JSON(http.StatusBadRequest, gin.H{"error": "grid_index duplicated"})
			return
		}
		seenGrid[grid.GridIndex] = struct{}{}

		foodCode := strings.TrimSpace(grid.FoodCode)
		if foodCode == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "food_code is required"})
			return
		}

		item, err := h.foodLibrary.FindByCode(c.Request.Context(), foodCode)
		if err != nil {
			switch {
			case errors.Is(err, service.ErrInvalidInput):
				c.JSON(http.StatusBadRequest, gin.H{"error": "food_code is required"})
			case errors.Is(err, service.ErrFoodNotFound):
				c.JSON(http.StatusBadRequest, gin.H{"error": "food_code not found"})
			default:
				c.JSON(http.StatusInternalServerError, gin.H{"error": "resolve food_code failed"})
			}
			return
		}

		grids = append(grids, model.MealGrid{
			GridIndex:      grid.GridIndex,
			FoodName:       item.FoodNameCN,
			UnitCalPer100G: item.DefaultUnitCalPer100G,
		})
	}

	if err := h.mealService.AttachFoods(c.Request.Context(), userID, mealID, grids); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "meal not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "vision confirm failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "视觉识别确认成功，卡路里已就绪"})
}

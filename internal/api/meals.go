package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"time"

	"kxyz-backend/internal/model"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MealQueryService interface {
	ListMeals(ctx context.Context, cursor *time.Time) ([]model.Meal, error)
	GetMealByID(ctx context.Context, mealID string) (model.Meal, error)
	GetMealTrajectory(ctx context.Context, mealID string, lastTimestamp *time.Time) ([]model.MealCurveData, error)
}

type MealsHandler struct {
	service MealQueryService
}

type mealResponse struct {
	MealID          string `json:"meal_id"`
	UserID          string `json:"user_id"`
	StartTime       string `json:"start_time"`
	DurationMinutes int    `json:"duration_minutes"`
	TotalServedG    int    `json:"total_served_g"`
	TotalLeftoverG  int    `json:"total_leftover_g"`
}

type trajectoryPointResponse struct {
	Timestamp string `json:"timestamp"`
	WeightG   int    `json:"weight_g"`
}

func NewMealsHandler(service MealQueryService) *MealsHandler {
	return &MealsHandler{service: service}
}

func (h *MealsHandler) List(c *gin.Context) {
	cursor, err := parseMealCursor(c.Query("cursor"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "cursor must be RFC3339 or unix seconds"})
		return
	}

	meals, err := h.service.ListMeals(c.Request.Context(), cursor)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "list meals failed"})
		return
	}

	items := make([]mealResponse, 0, len(meals))
	nextCursor := ""
	for _, meal := range meals {
		items = append(items, toMealResponse(meal))
	}
	if len(meals) > 0 {
		nextCursor = meals[len(meals)-1].StartTime.UTC().Format(time.RFC3339Nano)
	}

	c.JSON(http.StatusOK, gin.H{
		"items":       items,
		"next_cursor": nextCursor,
	})
}

func (h *MealsHandler) GetByID(c *gin.Context) {
	mealID := c.Param("meal_id")
	if mealID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "meal_id is required"})
		return
	}

	meal, err := h.service.GetMealByID(c.Request.Context(), mealID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "meal not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get meal failed"})
		return
	}

	c.JSON(http.StatusOK, toMealResponse(meal))
}

func (h *MealsHandler) Trajectory(c *gin.Context) {
	mealID := c.Param("meal_id")
	if mealID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "meal_id is required"})
		return
	}

	lastTimestamp, err := parseMealCursor(c.Query("last_timestamp"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "last_timestamp must be RFC3339 or unix seconds"})
		return
	}

	sampleInterval, err := parseSampleInterval(c.Query("sample_interval"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "sample_interval must be a positive integer"})
		return
	}

	points, err := h.service.GetMealTrajectory(c.Request.Context(), mealID, lastTimestamp)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get meal trajectory failed"})
		return
	}

	if sampleInterval > 1 {
		points = downsampleTrajectory(points, sampleInterval)
	}

	items := toTrajectoryResponses(points)
	last := ""
	if len(items) > 0 {
		last = items[len(items)-1].Timestamp
	}

	c.JSON(http.StatusOK, gin.H{
		"meal_id":        mealID,
		"items":          items,
		"last_timestamp": last,
	})
}

func parseMealCursor(raw string) (*time.Time, error) {
	if raw == "" {
		return nil, nil
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		utc := t.UTC()
		return &utc, nil
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		utc := t.UTC()
		return &utc, nil
	}
	if unix, err := strconv.ParseInt(raw, 10, 64); err == nil {
		t := time.Unix(unix, 0).UTC()
		return &t, nil
	}
	return nil, strconv.ErrSyntax
}

func toMealResponse(meal model.Meal) mealResponse {
	return mealResponse{
		MealID:          meal.MealID,
		UserID:          meal.UserID,
		StartTime:       meal.StartTime.UTC().Format(time.RFC3339Nano),
		DurationMinutes: meal.DurationMinutes,
		TotalServedG:    meal.TotalServedG,
		TotalLeftoverG:  meal.TotalLeftoverG,
	}
}

func toTrajectoryResponses(points []model.MealCurveData) []trajectoryPointResponse {
	items := make([]trajectoryPointResponse, 0, len(points))
	for _, point := range points {
		items = append(items, trajectoryPointResponse{
			Timestamp: point.Timestamp.UTC().Format(time.RFC3339Nano),
			WeightG:   point.WeightG,
		})
	}
	return items
}

func parseSampleInterval(raw string) (int, error) {
	if raw == "" {
		return 0, nil
	}
	n, err := strconv.Atoi(raw)
	if err != nil || n <= 0 {
		return 0, strconv.ErrSyntax
	}
	return n, nil
}

func downsampleTrajectory(points []model.MealCurveData, intervalSeconds int) []model.MealCurveData {
	if len(points) == 0 || intervalSeconds <= 1 {
		return points
	}

	bucketSize := int64(intervalSeconds)
	result := make([]model.MealCurveData, 0, len(points))

	currentBucket := points[0].Timestamp.UTC().Unix() / bucketSize
	sum := 0
	count := 0

	flush := func(bucket int64) {
		if count == 0 {
			return
		}
		result = append(result, model.MealCurveData{
			MealID:    points[0].MealID,
			Timestamp: time.Unix(bucket*bucketSize, 0).UTC(),
			WeightG:   sum / count,
		})
	}

	for _, point := range points {
		bucket := point.Timestamp.UTC().Unix() / bucketSize
		if bucket != currentBucket {
			flush(currentBucket)
			currentBucket = bucket
			sum = 0
			count = 0
		}
		sum += point.WeightG
		count++
	}
	flush(currentBucket)

	return result
}

package api

import (
	"context"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type MealQueryService interface {
	ListMeals(ctx context.Context, cursor *time.Time) ([]model.Meal, error)
	GetMealDetail(ctx context.Context, mealID string) (model.Meal, []model.MealGrid, error)
	AttachFoods(ctx context.Context, mealID string, grids []model.MealGrid) error
	GetMealTrajectory(ctx context.Context, mealID string, lastTimestamp *time.Time) ([]model.MealCurveData, error)
	AggregateDailyStatistics(
		ctx context.Context,
		userID string,
		startDate time.Time,
		endDate time.Time,
	) ([]model.DailyStatisticsRow, error)
}

type MealsHandler struct {
	service MealQueryService
}

type mealListItemResponse struct {
	MealID          string  `json:"meal_id"`
	StartTime       string  `json:"start_time"`
	DurationMinutes int     `json:"duration_minutes"`
	TotalMealCal    float64 `json:"total_meal_cal"`
}

type mealDetailResponse struct {
	MealID          string                   `json:"meal_id"`
	StartTime       string                   `json:"start_time"`
	DurationMinutes int                      `json:"duration_minutes"`
	TotalMealCal    float64                  `json:"total_meal_cal"`
	GridDetails     []mealDetailGridResponse `json:"grid_details"`
}

type mealDetailGridResponse struct {
	GridIndex    int     `json:"grid_index"`
	FoodName     string  `json:"food_name"`
	ServedG      int     `json:"served_g"`
	LeftoverG    int     `json:"leftover_g"`
	IntakeG      int     `json:"intake_g"`
	TotalCal     float64 `json:"total_cal"`
	SpeedGPerMin float64 `json:"speed_g_per_min"`
}

type trajectoryPointResponse struct {
	Timestamp string                    `json:"timestamp"`
	Weights   trajectoryWeightsResponse `json:"weights"`
}

type trajectoryWeightsResponse struct {
	Grid1 float64 `json:"grid_1"`
	Grid2 float64 `json:"grid_2"`
	Grid3 float64 `json:"grid_3"`
	Grid4 float64 `json:"grid_4"`
}

type statisticsChartDataResponse struct {
	Dates           []string  `json:"dates"`
	DailyServedG    []float64 `json:"daily_served_g"`
	DailyIntakeG    []float64 `json:"daily_intake_g"`
	DailyCalories   []float64 `json:"daily_calories"`
	AvgSpeedGPerMin []float64 `json:"avg_speed_g_per_min"`
}

type mealFoodsRequest struct {
	Grids []mealFoodGridRequest `json:"grids" binding:"required"`
}

type mealFoodGridRequest struct {
	GridIndex      int     `json:"grid_index"`
	FoodName       string  `json:"food_name"`
	UnitCalPer100G float64 `json:"unit_cal_per_100g"`
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

	items := make([]mealListItemResponse, 0, len(meals))
	nextCursor := ""
	for _, meal := range meals {
		_, grids, err := h.service.GetMealDetail(c.Request.Context(), meal.MealID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": "list meals failed"})
			return
		}
		items = append(items, mealListItemResponse{
			MealID:          meal.MealID,
			StartTime:       meal.StartTime.UTC().Format(time.RFC3339Nano),
			DurationMinutes: meal.DurationMinutes,
			TotalMealCal:    sumGridCalories(grids),
		})
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

	meal, grids, err := h.service.GetMealDetail(c.Request.Context(), mealID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			c.JSON(http.StatusNotFound, gin.H{"error": "meal not found"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "get meal failed"})
		return
	}

	c.JSON(http.StatusOK, toMealDetailResponse(meal, grids))
}

func (h *MealsHandler) PutFoods(c *gin.Context) {
	mealID := c.Param("meal_id")
	if mealID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "meal_id is required"})
		return
	}

	var req mealFoodsRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.Grids) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "grids is required"})
		return
	}

	grids := make([]model.MealGrid, 0, len(req.Grids))
	for _, grid := range req.Grids {
		if grid.GridIndex < 1 || grid.GridIndex > 4 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "grid_index must be in [1,4]"})
			return
		}
		foodName := strings.TrimSpace(grid.FoodName)
		if foodName == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "food_name is required"})
			return
		}
		if grid.UnitCalPer100G < 0 {
			c.JSON(http.StatusBadRequest, gin.H{"error": "unit_cal_per_100g must be non-negative"})
			return
		}
		grids = append(grids, model.MealGrid{
			GridIndex:      grid.GridIndex,
			FoodName:       foodName,
			UnitCalPer100G: grid.UnitCalPer100G,
		})
	}

	if err := h.service.AttachFoods(c.Request.Context(), mealID, grids); err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		case errors.Is(err, gorm.ErrRecordNotFound):
			c.JSON(http.StatusNotFound, gin.H{"error": "meal not found"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "attach foods failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "食物信息挂载成功，卡路里已就绪"})
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

func (h *MealsHandler) StatisticsCharts(c *gin.Context) {
	userID, ok := c.Get("user_id")
	if !ok || strings.TrimSpace(toString(userID)) == "" {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}

	startDate, endDate, err := parseStatisticsDateRange(c.Query("start_date"), c.Query("end_date"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	rows, err := h.service.AggregateDailyStatistics(
		c.Request.Context(),
		strings.TrimSpace(toString(userID)),
		startDate,
		endDate,
	)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid date range"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "get statistics charts failed"})
		}
		return
	}

	chartData := buildStatisticsChartData(startDate, endDate, rows)
	c.JSON(http.StatusOK, gin.H{
		"user_id":    strings.TrimSpace(toString(userID)),
		"date_range": []string{startDate.Format("2006-01-02"), endDate.Format("2006-01-02")},
		"chart_data": chartData,
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

func toMealDetailResponse(meal model.Meal, grids []model.MealGrid) mealDetailResponse {
	gridDetails := make([]mealDetailGridResponse, 0, len(grids))
	for _, grid := range grids {
		speed := 0.0
		if meal.DurationMinutes > 0 {
			speed = float64(grid.IntakeG) / float64(meal.DurationMinutes)
		}
		gridDetails = append(gridDetails, mealDetailGridResponse{
			GridIndex:    grid.GridIndex,
			FoodName:     grid.FoodName,
			ServedG:      grid.ServedG,
			LeftoverG:    grid.LeftoverG,
			IntakeG:      grid.IntakeG,
			TotalCal:     grid.TotalCal,
			SpeedGPerMin: speed,
		})
	}

	return mealDetailResponse{
		MealID:          meal.MealID,
		StartTime:       meal.StartTime.UTC().Format(time.RFC3339Nano),
		DurationMinutes: meal.DurationMinutes,
		TotalMealCal:    sumGridCalories(grids),
		GridDetails:     gridDetails,
	}
}

func sumGridCalories(grids []model.MealGrid) float64 {
	total := 0.0
	for _, grid := range grids {
		total += grid.TotalCal
	}
	return total
}

func toTrajectoryResponses(points []model.MealCurveData) []trajectoryPointResponse {
	items := make([]trajectoryPointResponse, 0, len(points))
	for _, point := range points {
		weights := pointToTrajectoryWeights(point)
		items = append(items, trajectoryPointResponse{
			Timestamp: point.Timestamp.UTC().Format(time.RFC3339Nano),
			Weights: trajectoryWeightsResponse{
				Grid1: float64(weights[0]),
				Grid2: float64(weights[1]),
				Grid3: float64(weights[2]),
				Grid4: float64(weights[3]),
			},
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

func parseStatisticsDateRange(startRaw string, endRaw string) (time.Time, time.Time, error) {
	startRaw = strings.TrimSpace(startRaw)
	endRaw = strings.TrimSpace(endRaw)
	if startRaw == "" || endRaw == "" {
		return time.Time{}, time.Time{}, errors.New("start_date and end_date are required")
	}

	startDate, err := time.Parse("2006-01-02", startRaw)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("start_date must be YYYY-MM-DD")
	}
	endDate, err := time.Parse("2006-01-02", endRaw)
	if err != nil {
		return time.Time{}, time.Time{}, errors.New("end_date must be YYYY-MM-DD")
	}
	startDate = startDate.UTC()
	endDate = endDate.UTC()
	if endDate.Before(startDate) {
		return time.Time{}, time.Time{}, errors.New("end_date must be on or after start_date")
	}

	return startDate, endDate, nil
}

func buildStatisticsChartData(
	startDate time.Time,
	endDate time.Time,
	rows []model.DailyStatisticsRow,
) statisticsChartDataResponse {
	byDate := make(map[string]model.DailyStatisticsRow, len(rows))
	for _, row := range rows {
		normalizedDate := normalizeStatisticsDate(row.Date)
		if normalizedDate == "" {
			continue
		}
		byDate[normalizedDate] = row
	}

	chart := statisticsChartDataResponse{
		Dates:           []string{},
		DailyServedG:    []float64{},
		DailyIntakeG:    []float64{},
		DailyCalories:   []float64{},
		AvgSpeedGPerMin: []float64{},
	}

	for day := startDate; !day.After(endDate); day = day.AddDate(0, 0, 1) {
		key := day.Format("2006-01-02")
		chart.Dates = append(chart.Dates, day.Format("01-02"))
		if row, ok := byDate[key]; ok {
			chart.DailyServedG = append(chart.DailyServedG, row.DailyServedG)
			chart.DailyIntakeG = append(chart.DailyIntakeG, row.DailyIntakeG)
			chart.DailyCalories = append(chart.DailyCalories, row.DailyCalories)
			chart.AvgSpeedGPerMin = append(chart.AvgSpeedGPerMin, row.AvgSpeedGPerMin)
			continue
		}

		chart.DailyServedG = append(chart.DailyServedG, 0)
		chart.DailyIntakeG = append(chart.DailyIntakeG, 0)
		chart.DailyCalories = append(chart.DailyCalories, 0)
		chart.AvgSpeedGPerMin = append(chart.AvgSpeedGPerMin, 0)
	}

	return chart
}

func normalizeStatisticsDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	if len(raw) >= 10 {
		candidate := raw[:10]
		if _, err := time.Parse("2006-01-02", candidate); err == nil {
			return candidate
		}
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t.UTC().Format("2006-01-02")
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC().Format("2006-01-02")
	}
	return ""
}

func toString(value any) string {
	text, ok := value.(string)
	if !ok {
		return ""
	}
	return text
}

func downsampleTrajectory(points []model.MealCurveData, intervalSeconds int) []model.MealCurveData {
	if len(points) == 0 || intervalSeconds <= 1 {
		return points
	}

	bucketSize := int64(intervalSeconds)
	result := make([]model.MealCurveData, 0, len(points))

	currentBucket := points[0].Timestamp.UTC().Unix() / bucketSize
	sum := 0
	sumGrid1 := 0
	sumGrid2 := 0
	sumGrid3 := 0
	sumGrid4 := 0
	count := 0

	flush := func(bucket int64) {
		if count == 0 {
			return
		}
		avgGrid1 := sumGrid1 / count
		avgGrid2 := sumGrid2 / count
		avgGrid3 := sumGrid3 / count
		avgGrid4 := sumGrid4 / count
		result = append(result, model.MealCurveData{
			MealID:    points[0].MealID,
			Timestamp: time.Unix(bucket*bucketSize, 0).UTC(),
			WeightG:   sum / count,
			Grid1G:    avgGrid1,
			Grid2G:    avgGrid2,
			Grid3G:    avgGrid3,
			Grid4G:    avgGrid4,
		})
	}

	for _, point := range points {
		bucket := point.Timestamp.UTC().Unix() / bucketSize
		if bucket != currentBucket {
			flush(currentBucket)
			currentBucket = bucket
			sum = 0
			sumGrid1 = 0
			sumGrid2 = 0
			sumGrid3 = 0
			sumGrid4 = 0
			count = 0
		}
		sum += point.WeightG
		weights := pointToTrajectoryWeights(point)
		sumGrid1 += weights[0]
		sumGrid2 += weights[1]
		sumGrid3 += weights[2]
		sumGrid4 += weights[3]
		count++
	}
	flush(currentBucket)

	return result
}

func pointToTrajectoryWeights(point model.MealCurveData) [4]int {
	grids := [4]int{point.Grid1G, point.Grid2G, point.Grid3G, point.Grid4G}
	if grids[0]+grids[1]+grids[2]+grids[3] == 0 && point.WeightG > 0 {
		grids[0] = point.WeightG
	}
	return grids
}

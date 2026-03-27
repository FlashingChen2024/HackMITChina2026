package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type GormMealQueryStore struct {
	db *gorm.DB
}

func NewGormMealQueryStore(db *gorm.DB) *GormMealQueryStore {
	return &GormMealQueryStore{db: db}
}

func (s *GormMealQueryStore) ListMeals(
	ctx context.Context,
	userID string,
	cursor *time.Time,
	limit int,
) ([]model.Meal, error) {
	query := s.db.WithContext(ctx).
		Model(&model.Meal{}).
		Where("user_id = ?", userID).
		Order("start_time DESC")
	if cursor != nil {
		query = query.Where("start_time < ?", cursor.UTC())
	}

	var meals []model.Meal
	if err := query.Limit(limit).Find(&meals).Error; err != nil {
		return nil, fmt.Errorf("list meals: %w", err)
	}
	return meals, nil
}

func (s *GormMealQueryStore) GetMealByID(
	ctx context.Context,
	userID string,
	mealID string,
) (model.Meal, error) {
	var meal model.Meal
	if err := s.db.WithContext(ctx).
		Model(&model.Meal{}).
		Where("meal_id = ? AND user_id = ?", mealID, userID).
		First(&meal).Error; err != nil {
		return model.Meal{}, fmt.Errorf("get meal by id: %w", err)
	}
	return meal, nil
}

func (s *GormMealQueryStore) ListMealGrids(ctx context.Context, mealID string) ([]model.MealGrid, error) {
	var grids []model.MealGrid
	if err := s.db.WithContext(ctx).
		Model(&model.MealGrid{}).
		Where("meal_id = ?", mealID).
		Order("grid_index ASC").
		Find(&grids).Error; err != nil {
		return nil, fmt.Errorf("list meal grids: %w", err)
	}
	return grids, nil
}

func (s *GormMealQueryStore) UpdateMealGridFood(
	ctx context.Context,
	mealID string,
	gridIndex int,
	foodName string,
	unitCalPer100G float64,
) error {
	update := map[string]any{
		"food_name":         foodName,
		"unit_cal_per_100g": unitCalPer100G,
		"total_cal":         gorm.Expr("intake_g * ? / 100", unitCalPer100G),
	}

	tx := s.db.WithContext(ctx).
		Model(&model.MealGrid{}).
		Where("meal_id = ? AND grid_index = ?", mealID, gridIndex).
		Updates(update)
	if tx.Error != nil {
		return fmt.Errorf("update meal grid food: %w", tx.Error)
	}
	if tx.RowsAffected == 0 {
		return fmt.Errorf("update meal grid food: %w", gorm.ErrRecordNotFound)
	}
	return nil
}

func (s *GormMealQueryStore) ListMealTrajectory(
	ctx context.Context,
	userID string,
	mealID string,
	lastTimestamp *time.Time,
) ([]model.MealCurveData, error) {
	query := s.db.WithContext(ctx).
		Model(&model.MealCurveData{}).
		Joins("JOIN meals AS m ON m.meal_id = meal_curve_data.meal_id").
		Where("meal_curve_data.meal_id = ? AND m.user_id = ?", mealID, userID)
	if lastTimestamp != nil {
		query = query.Where("meal_curve_data.timestamp > ?", lastTimestamp.UTC())
	}

	var points []model.MealCurveData
	if err := query.Order("meal_curve_data.timestamp ASC").Find(&points).Error; err != nil {
		return nil, fmt.Errorf("list meal trajectory: %w", err)
	}
	return points, nil
}

func (s *GormMealQueryStore) AggregateDailyStatistics(
	ctx context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	start := truncateUTCDate(startDate)
	end := truncateUTCDate(endDate)
	if end.Before(start) {
		return nil, fmt.Errorf("aggregate daily statistics: end_date before start_date")
	}

	startText := start.Format("2006-01-02")
	endText := end.Format("2006-01-02")

	mealDaily := s.db.WithContext(ctx).
		Table("meals AS m").
		Select(`
DATE(m.start_time) AS stat_date,
m.meal_id AS meal_id,
SUM(mg.served_g) AS meal_served_g,
SUM(mg.intake_g) AS meal_intake_g,
SUM(mg.total_cal) AS meal_calories,
CASE WHEN m.duration_minutes > 0
THEN SUM(mg.intake_g) * 1.0 / m.duration_minutes
ELSE 0
END AS meal_speed_g_per_min`).
		Joins("JOIN meal_grids AS mg ON mg.meal_id = m.meal_id").
		Where("m.user_id = ?", userID).
		Where("DATE(m.start_time) >= ? AND DATE(m.start_time) <= ?", startText, endText).
		Group("DATE(m.start_time), m.meal_id, m.duration_minutes")

	var rows []model.DailyStatisticsRow
	if err := s.db.WithContext(ctx).
		Table("(?) AS meal_daily", mealDaily).
		Select(`
meal_daily.stat_date AS date,
SUM(meal_daily.meal_served_g) AS daily_served_g,
SUM(meal_daily.meal_intake_g) AS daily_intake_g,
SUM(meal_daily.meal_calories) AS daily_calories,
AVG(meal_daily.meal_speed_g_per_min) AS avg_speed_g_per_min`).
		Group("meal_daily.stat_date").
		Order("meal_daily.stat_date ASC").
		Scan(&rows).Error; err != nil {
		return nil, fmt.Errorf("aggregate daily statistics: %w", err)
	}

	return rows, nil
}

func truncateUTCDate(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

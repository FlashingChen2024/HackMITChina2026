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

func (s *GormMealQueryStore) ListMeals(ctx context.Context, cursor *time.Time, limit int) ([]model.Meal, error) {
	query := s.db.WithContext(ctx).Model(&model.Meal{}).Order("start_time DESC")
	if cursor != nil {
		query = query.Where("start_time < ?", cursor.UTC())
	}

	var meals []model.Meal
	if err := query.Limit(limit).Find(&meals).Error; err != nil {
		return nil, fmt.Errorf("list meals: %w", err)
	}
	return meals, nil
}

func (s *GormMealQueryStore) GetMealByID(ctx context.Context, mealID string) (model.Meal, error) {
	var meal model.Meal
	if err := s.db.WithContext(ctx).Model(&model.Meal{}).Where("meal_id = ?", mealID).First(&meal).Error; err != nil {
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
	mealID string,
	lastTimestamp *time.Time,
) ([]model.MealCurveData, error) {
	query := s.db.WithContext(ctx).Model(&model.MealCurveData{}).Where("meal_id = ?", mealID)
	if lastTimestamp != nil {
		query = query.Where("timestamp > ?", lastTimestamp.UTC())
	}

	var points []model.MealCurveData
	if err := query.Order("timestamp ASC").Find(&points).Error; err != nil {
		return nil, fmt.Errorf("list meal trajectory: %w", err)
	}
	return points, nil
}

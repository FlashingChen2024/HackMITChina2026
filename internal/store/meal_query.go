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

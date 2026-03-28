package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type GormAIAdviceStore struct {
	db        *gorm.DB
	mealQuery *GormMealQueryStore
}

func NewGormAIAdviceStore(db *gorm.DB) *GormAIAdviceStore {
	return &GormAIAdviceStore{
		db:        db,
		mealQuery: NewGormMealQueryStore(db),
	}
}

func (s *GormAIAdviceStore) GetLatestMealWithGrids(
	ctx context.Context,
	userID string,
) (model.Meal, []model.MealGrid, error) {
	var meal model.Meal
	if err := s.db.WithContext(ctx).
		Model(&model.Meal{}).
		Where("user_id = ?", userID).
		Order("start_time DESC").
		First(&meal).Error; err != nil {
		return model.Meal{}, nil, fmt.Errorf("get latest meal: %w", err)
	}

	var grids []model.MealGrid
	if err := s.db.WithContext(ctx).
		Model(&model.MealGrid{}).
		Where("meal_id = ?", meal.MealID).
		Order("grid_index ASC").
		Find(&grids).Error; err != nil {
		return model.Meal{}, nil, fmt.Errorf("list latest meal grids: %w", err)
	}

	return meal, grids, nil
}

func (s *GormAIAdviceStore) GetUserProfileByUserID(
	ctx context.Context,
	userID string,
) (model.UserProfile, error) {
	var profile model.UserProfile
	if err := s.db.WithContext(ctx).
		Model(&model.UserProfile{}).
		Where("user_id = ?", userID).
		First(&profile).Error; err != nil {
		return model.UserProfile{}, fmt.Errorf("get user profile: %w", err)
	}
	return profile, nil
}

func (s *GormAIAdviceStore) SumTodayCalories(
	ctx context.Context,
	userID string,
	start time.Time,
	end time.Time,
) (float64, error) {
	var row struct {
		Total float64 `gorm:"column:total"`
	}

	if err := s.db.WithContext(ctx).
		Table("meal_grids AS mg").
		Select("COALESCE(SUM(mg.total_cal), 0) AS total").
		Joins("JOIN meals AS m ON m.meal_id = mg.meal_id").
		Where("m.user_id = ?", userID).
		Where("m.start_time >= ? AND m.start_time < ?", start.UTC(), end.UTC()).
		Scan(&row).Error; err != nil {
		return 0, fmt.Errorf("sum today calories: %w", err)
	}

	return row.Total, nil
}

func (s *GormAIAdviceStore) AggregateDailyStatistics(
	ctx context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	rows, err := s.mealQuery.AggregateDailyStatistics(ctx, userID, startDate, endDate)
	if err != nil {
		return nil, fmt.Errorf("aggregate ai statistics: %w", err)
	}
	return rows, nil
}

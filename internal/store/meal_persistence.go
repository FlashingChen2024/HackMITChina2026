package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type GormMealPersistence struct {
	db *gorm.DB
}

func NewGormMealPersistence(db *gorm.DB) *GormMealPersistence {
	return &GormMealPersistence{db: db}
}

func (p *GormMealPersistence) CreateMeal(ctx context.Context, mealID string, startTime time.Time, totalServedG int) error {
	meal := model.Meal{
		MealID:       mealID,
		UserID:       "",
		StartTime:    startTime.UTC(),
		TotalServedG: totalServedG,
	}

	if err := p.db.WithContext(ctx).Create(&meal).Error; err != nil {
		return fmt.Errorf("insert meal: %w", err)
	}
	return nil
}

func (p *GormMealPersistence) InsertMealCurveData(ctx context.Context, mealID string, timestamp time.Time, weightG int) error {
	point := model.MealCurveData{
		MealID:    mealID,
		Timestamp: timestamp.UTC(),
		WeightG:   weightG,
	}

	if err := p.db.WithContext(ctx).Create(&point).Error; err != nil {
		return fmt.Errorf("insert meal curve data: %w", err)
	}
	return nil
}

func (p *GormMealPersistence) UpdateMealSummary(ctx context.Context, mealID string, durationMinutes int, totalLeftoverG int) error {
	update := map[string]any{
		"duration_minutes": durationMinutes,
		"total_leftover_g": totalLeftoverG,
	}

	tx := p.db.WithContext(ctx).Model(&model.Meal{}).Where("meal_id = ?", mealID).Updates(update)
	if tx.Error != nil {
		return fmt.Errorf("update meal summary: %w", tx.Error)
	}
	if tx.RowsAffected == 0 {
		return fmt.Errorf("update meal summary: meal %s not found", mealID)
	}
	return nil
}

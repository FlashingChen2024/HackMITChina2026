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

func (p *GormMealPersistence) CreateMeal(
	ctx context.Context,
	mealID string,
	userID string,
	startTime time.Time,
) error {
	meal := model.Meal{
		MealID:    mealID,
		UserID:    userID,
		StartTime: startTime.UTC(),
	}

	if err := p.db.WithContext(ctx).Create(&meal).Error; err != nil {
		return fmt.Errorf("insert meal: %w", err)
	}
	return nil
}

func (p *GormMealPersistence) InsertMealCurveData(
	ctx context.Context,
	mealID string,
	timestamp time.Time,
	weightG int,
	gridWeights [4]int,
) error {
	point := model.MealCurveData{
		MealID:    mealID,
		Timestamp: timestamp.UTC(),
		WeightG:   weightG,
		Grid1G:    gridWeights[0],
		Grid2G:    gridWeights[1],
		Grid3G:    gridWeights[2],
		Grid4G:    gridWeights[3],
	}

	if err := p.db.WithContext(ctx).Create(&point).Error; err != nil {
		return fmt.Errorf("insert meal curve data: %w", err)
	}
	return nil
}

func (p *GormMealPersistence) UpdateMealSummary(ctx context.Context, mealID string, durationMinutes int) error {
	update := map[string]any{
		"duration_minutes": durationMinutes,
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

func (p *GormMealPersistence) InsertMealGrids(ctx context.Context, mealID string, grids []model.MealGrid) error {
	if len(grids) == 0 {
		return nil
	}

	rows := make([]model.MealGrid, 0, len(grids))
	for _, grid := range grids {
		grid.MealID = mealID
		rows = append(rows, grid)
	}

	if err := p.db.WithContext(ctx).Create(&rows).Error; err != nil {
		return fmt.Errorf("insert meal grids: %w", err)
	}
	return nil
}

package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type GormMealTimeAlertStore struct {
	db *gorm.DB
}

func NewGormMealTimeAlertStore(db *gorm.DB) *GormMealTimeAlertStore {
	return &GormMealTimeAlertStore{db: db}
}

func (s *GormMealTimeAlertStore) ListEnabledAlertSettings(ctx context.Context) ([]model.AlertSetting, error) {
	var rows []model.AlertSetting
	if err := s.db.WithContext(ctx).
		Model(&model.AlertSetting{}).
		Where("global_enabled = ?", true).
		Find(&rows).Error; err != nil {
		return nil, fmt.Errorf("list enabled alert settings: %w", err)
	}
	return rows, nil
}

func (s *GormMealTimeAlertStore) ExistsMealInWindow(
	ctx context.Context,
	userID string,
	start time.Time,
	end time.Time,
) (bool, error) {
	var count int64
	if err := s.db.WithContext(ctx).
		Model(&model.Meal{}).
		Where("user_id = ?", userID).
		Where("start_time >= ? AND start_time <= ?", start.UTC(), end.UTC()).
		Count(&count).Error; err != nil {
		return false, fmt.Errorf("exists meal in window: %w", err)
	}
	return count > 0, nil
}

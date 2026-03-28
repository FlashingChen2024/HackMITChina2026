package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GormAlertSettingStore struct {
	db *gorm.DB
}

func NewGormAlertSettingStore(db *gorm.DB) *GormAlertSettingStore {
	return &GormAlertSettingStore{db: db}
}

func (s *GormAlertSettingStore) UpsertAlertSetting(ctx context.Context, setting model.AlertSetting) error {
	now := time.Now().UTC()
	if setting.CreatedAt.IsZero() {
		setting.CreatedAt = now
	}
	setting.UpdatedAt = now

	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]any{
				"email":      setting.Email,
				"enabled":    setting.Enabled,
				"updated_at": now,
			}),
		}).
		Create(&setting).Error; err != nil {
		return fmt.Errorf("upsert alert setting: %w", err)
	}

	return nil
}

func (s *GormAlertSettingStore) GetAlertSettingByUserID(ctx context.Context, userID string) (model.AlertSetting, error) {
	var setting model.AlertSetting
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&setting).Error; err != nil {
		return model.AlertSetting{}, fmt.Errorf("get alert setting by user id: %w", err)
	}
	return setting, nil
}

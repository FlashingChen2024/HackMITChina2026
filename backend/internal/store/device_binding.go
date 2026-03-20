package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GormDeviceBindingStore struct {
	db *gorm.DB
}

func NewGormDeviceBindingStore(db *gorm.DB) *GormDeviceBindingStore {
	return &GormDeviceBindingStore{db: db}
}

func (s *GormDeviceBindingStore) GetByDeviceID(ctx context.Context, deviceID string) (model.DeviceBinding, error) {
	var binding model.DeviceBinding
	if err := s.db.WithContext(ctx).
		Model(&model.DeviceBinding{}).
		Where("device_id = ?", deviceID).
		First(&binding).Error; err != nil {
		return model.DeviceBinding{}, fmt.Errorf("get device binding by device id: %w", err)
	}
	return binding, nil
}

func (s *GormDeviceBindingStore) ListByUserID(ctx context.Context, userID string) ([]model.DeviceBinding, error) {
	var bindings []model.DeviceBinding
	if err := s.db.WithContext(ctx).
		Model(&model.DeviceBinding{}).
		Where("user_id = ?", userID).
		Find(&bindings).Error; err != nil {
		return nil, fmt.Errorf("list device bindings by user id: %w", err)
	}
	return bindings, nil
}

func (s *GormDeviceBindingStore) BindDevice(ctx context.Context, deviceID string, userID string) error {
	now := time.Now().UTC()
	binding := model.DeviceBinding{
		DeviceID:  deviceID,
		UserID:    userID,
		CreatedAt: now,
		UpdatedAt: now,
	}
	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "device_id"}},
			DoUpdates: clause.Assignments(map[string]any{"user_id": userID, "updated_at": now}),
		}).
		Create(&binding).Error; err != nil {
		return fmt.Errorf("bind device: %w", err)
	}
	return nil
}

func (s *GormDeviceBindingStore) UnbindDevice(ctx context.Context, deviceID string, userID string) (bool, error) {
	result := s.db.WithContext(ctx).
		Where("device_id = ? AND user_id = ?", deviceID, userID).
		Delete(&model.DeviceBinding{})
	if result.Error != nil {
		return false, fmt.Errorf("unbind device: %w", result.Error)
	}
	return result.RowsAffected > 0, nil
}

func (s *GormDeviceBindingStore) IsDeviceBoundToOtherUser(
	ctx context.Context,
	deviceID string,
	userID string,
) (bool, error) {
	var binding model.DeviceBinding
	err := s.db.WithContext(ctx).
		Model(&model.DeviceBinding{}).
		Where("device_id = ?", deviceID).
		First(&binding).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return false, nil
		}
		return false, fmt.Errorf("check device binding owner: %w", err)
	}
	return binding.UserID != userID, nil
}

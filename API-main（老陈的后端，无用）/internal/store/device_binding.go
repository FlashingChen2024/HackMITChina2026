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

/**
 * v4.2：按 user_id 列出已绑定设备
 */
func (s *GormDeviceBindingStore) ListByUserID(ctx context.Context, userID string) ([]model.DeviceBinding, error) {
	var bindings []model.DeviceBinding
	if err := s.db.WithContext(ctx).
		Model(&model.DeviceBinding{}).
		Where("user_id = ?", userID).
		Order("created_at DESC").
		Find(&bindings).Error; err != nil {
		return nil, fmt.Errorf("list device bindings by user id: %w", err)
	}
	return bindings, nil
}

/**
 * v4.2：删除指定 user_id 的 device_id 绑定记录
 */
func (s *GormDeviceBindingStore) DeleteByUserIDAndDeviceID(ctx context.Context, userID string, deviceID string) (int64, error) {
	tx := s.db.WithContext(ctx).
		Where("user_id = ? AND device_id = ?", userID, deviceID).
		Delete(&model.DeviceBinding{})
	if tx.Error != nil {
		return 0, fmt.Errorf("delete device binding: %w", tx.Error)
	}
	return tx.RowsAffected, nil
}

package service

import (
	"context"
	"errors"
	"strings"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

var (
	ErrDeviceNotBound       = errors.New("device not bound")
	ErrDeviceBoundToAnother = errors.New("device already bound to another user")
)

type DeviceBindingStore interface {
	GetByDeviceID(ctx context.Context, deviceID string) (model.DeviceBinding, error)
	BindDevice(ctx context.Context, deviceID string, userID string) error
	IsDeviceBoundToOtherUser(ctx context.Context, deviceID string, userID string) (bool, error)
	ListByUserID(ctx context.Context, userID string) ([]model.DeviceBinding, error)
	DeleteByUserIDAndDeviceID(ctx context.Context, userID string, deviceID string) (int64, error)
}

type DeviceBindingService struct {
	store DeviceBindingStore
}

func NewDeviceBindingService(store DeviceBindingStore) *DeviceBindingService {
	return &DeviceBindingService{store: store}
}

func (s *DeviceBindingService) BindDevice(ctx context.Context, userID string, deviceID string) error {
	userID = strings.TrimSpace(userID)
	deviceID = normalizeDeviceID(deviceID)
	if userID == "" || deviceID == "" {
		return ErrInvalidInput
	}

	boundToOther, err := s.store.IsDeviceBoundToOtherUser(ctx, deviceID, userID)
	if err != nil {
		return err
	}
	if boundToOther {
		return ErrDeviceBoundToAnother
	}

	if err := s.store.BindDevice(ctx, deviceID, userID); err != nil {
		return err
	}
	return nil
}

func (s *DeviceBindingService) ResolveUserID(ctx context.Context, deviceID string) (string, error) {
	deviceID = normalizeDeviceID(deviceID)
	if deviceID == "" {
		return "", ErrInvalidInput
	}

	binding, err := s.store.GetByDeviceID(ctx, deviceID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrDeviceNotBound
		}
		return "", err
	}
	return binding.UserID, nil
}

/**
 * 列出当前用户已绑定的设备列表（v4.2：GET /devices）
 */
func (s *DeviceBindingService) ListByUserID(ctx context.Context, userID string) ([]model.DeviceBinding, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalidInput
	}
	return s.store.ListByUserID(ctx, userID)
}

/**
 * 解绑当前用户的设备（v4.2：DELETE /devices/{device_id}）
 */
func (s *DeviceBindingService) UnbindDevice(ctx context.Context, userID string, deviceID string) error {
	userID = strings.TrimSpace(userID)
	deviceID = normalizeDeviceID(deviceID)
	if userID == "" || deviceID == "" {
		return ErrInvalidInput
	}

	// 若该设备被绑定到他人，直接返回错误，便于上层返回 403
	boundToOther, err := s.store.IsDeviceBoundToOtherUser(ctx, deviceID, userID)
	if err != nil {
		return err
	}
	if boundToOther {
		return ErrDeviceBoundToAnother
	}

	affected, err := s.store.DeleteByUserIDAndDeviceID(ctx, userID, deviceID)
	if err != nil {
		return err
	}
	if affected == 0 {
		return ErrDeviceNotBound
	}
	return nil
}

func normalizeDeviceID(deviceID string) string {
	return strings.ToUpper(strings.TrimSpace(deviceID))
}

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

func normalizeDeviceID(deviceID string) string {
	return strings.ToUpper(strings.TrimSpace(deviceID))
}

package service

import (
	"context"
	"testing"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type fakeDeviceBindingStore struct {
	byDevice map[string]model.DeviceBinding
	err      error
}

func newFakeDeviceBindingStore() *fakeDeviceBindingStore {
	return &fakeDeviceBindingStore{
		byDevice: make(map[string]model.DeviceBinding),
	}
}

func (s *fakeDeviceBindingStore) GetByDeviceID(_ context.Context, deviceID string) (model.DeviceBinding, error) {
	if s.err != nil {
		return model.DeviceBinding{}, s.err
	}
	binding, ok := s.byDevice[deviceID]
	if !ok {
		return model.DeviceBinding{}, gorm.ErrRecordNotFound
	}
	return binding, nil
}

func (s *fakeDeviceBindingStore) BindDevice(_ context.Context, deviceID string, userID string) error {
	if s.err != nil {
		return s.err
	}
	s.byDevice[deviceID] = model.DeviceBinding{DeviceID: deviceID, UserID: userID}
	return nil
}

func (s *fakeDeviceBindingStore) IsDeviceBoundToOtherUser(_ context.Context, deviceID string, userID string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	binding, ok := s.byDevice[deviceID]
	if !ok {
		return false, nil
	}
	return binding.UserID != userID, nil
}

func TestDeviceBindingServiceBindDevice(t *testing.T) {
	store := newFakeDeviceBindingStore()
	svc := NewDeviceBindingService(store)

	err := svc.BindDevice(context.Background(), "user-1", " esp32_a1b2c3 ")
	if err != nil {
		t.Fatalf("bind device failed: %v", err)
	}

	binding, ok := store.byDevice["ESP32_A1B2C3"]
	if !ok {
		t.Fatalf("expected normalized device binding to be saved")
	}
	if binding.UserID != "user-1" {
		t.Fatalf("expected user_id=user-1, got %s", binding.UserID)
	}
}

func TestDeviceBindingServiceBindDeviceRejectsOtherOwner(t *testing.T) {
	store := newFakeDeviceBindingStore()
	store.byDevice["ESP32_A1B2C3"] = model.DeviceBinding{
		DeviceID: "ESP32_A1B2C3",
		UserID:   "user-2",
	}
	svc := NewDeviceBindingService(store)

	err := svc.BindDevice(context.Background(), "user-1", "esp32_a1b2c3")
	if err != ErrDeviceBoundToAnother {
		t.Fatalf("expected ErrDeviceBoundToAnother, got %v", err)
	}
}

func TestDeviceBindingServiceResolveUserID(t *testing.T) {
	store := newFakeDeviceBindingStore()
	store.byDevice["ESP32_A1B2C3"] = model.DeviceBinding{
		DeviceID: "ESP32_A1B2C3",
		UserID:   "user-3",
	}
	svc := NewDeviceBindingService(store)

	userID, err := svc.ResolveUserID(context.Background(), "esp32_a1b2c3")
	if err != nil {
		t.Fatalf("resolve user id failed: %v", err)
	}
	if userID != "user-3" {
		t.Fatalf("expected user_id=user-3, got %s", userID)
	}
}

func TestDeviceBindingServiceResolveUserIDNotBound(t *testing.T) {
	store := newFakeDeviceBindingStore()
	svc := NewDeviceBindingService(store)

	_, err := svc.ResolveUserID(context.Background(), "esp32_a1b2c3")
	if err != ErrDeviceNotBound {
		t.Fatalf("expected ErrDeviceNotBound, got %v", err)
	}
}

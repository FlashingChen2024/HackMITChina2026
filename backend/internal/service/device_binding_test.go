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

func (s *fakeDeviceBindingStore) ListByUserID(_ context.Context, userID string) ([]model.DeviceBinding, error) {
	if s.err != nil {
		return nil, s.err
	}

	bindings := make([]model.DeviceBinding, 0)
	for _, binding := range s.byDevice {
		if binding.UserID == userID {
			bindings = append(bindings, binding)
		}
	}
	return bindings, nil
}

func (s *fakeDeviceBindingStore) UnbindDevice(_ context.Context, deviceID string, userID string) (bool, error) {
	if s.err != nil {
		return false, s.err
	}
	binding, ok := s.byDevice[deviceID]
	if !ok {
		return false, nil
	}
	if binding.UserID != userID {
		return false, nil
	}
	delete(s.byDevice, deviceID)
	return true, nil
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

func TestDeviceBindingServiceListDevices(t *testing.T) {
	store := newFakeDeviceBindingStore()
	store.byDevice["ESP32_A1"] = model.DeviceBinding{DeviceID: "ESP32_A1", UserID: "user-1"}
	store.byDevice["ESP32_B2"] = model.DeviceBinding{DeviceID: "ESP32_B2", UserID: "user-1"}
	store.byDevice["ESP32_C3"] = model.DeviceBinding{DeviceID: "ESP32_C3", UserID: "user-2"}
	svc := NewDeviceBindingService(store)

	devices, err := svc.ListDevices(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("list devices failed: %v", err)
	}
	if len(devices) != 2 {
		t.Fatalf("expected 2 devices, got %d", len(devices))
	}
	if !contains(devices, "ESP32_A1") || !contains(devices, "ESP32_B2") {
		t.Fatalf("expected devices to include ESP32_A1 and ESP32_B2, got %v", devices)
	}
}

func TestDeviceBindingServiceUnbindDeviceSuccess(t *testing.T) {
	store := newFakeDeviceBindingStore()
	store.byDevice["ESP32_A1"] = model.DeviceBinding{DeviceID: "ESP32_A1", UserID: "user-1"}
	svc := NewDeviceBindingService(store)

	if err := svc.UnbindDevice(context.Background(), "user-1", "esp32_a1"); err != nil {
		t.Fatalf("unbind device failed: %v", err)
	}
	if _, ok := store.byDevice["ESP32_A1"]; ok {
		t.Fatalf("expected binding to be removed")
	}
}

func TestDeviceBindingServiceUnbindDeviceForbidden(t *testing.T) {
	store := newFakeDeviceBindingStore()
	store.byDevice["ESP32_A1"] = model.DeviceBinding{DeviceID: "ESP32_A1", UserID: "user-2"}
	svc := NewDeviceBindingService(store)

	err := svc.UnbindDevice(context.Background(), "user-1", "esp32_a1")
	if err != ErrDeviceForbidden {
		t.Fatalf("expected ErrDeviceForbidden, got %v", err)
	}
	if _, ok := store.byDevice["ESP32_A1"]; !ok {
		t.Fatalf("expected binding to remain after forbidden operation")
	}
}

func TestDeviceBindingServiceUnbindDeviceNotBound(t *testing.T) {
	store := newFakeDeviceBindingStore()
	svc := NewDeviceBindingService(store)

	err := svc.UnbindDevice(context.Background(), "user-1", "esp32_a1")
	if err != ErrDeviceNotBound {
		t.Fatalf("expected ErrDeviceNotBound, got %v", err)
	}
}

func contains(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}

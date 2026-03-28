package service

import (
	"context"
	"testing"

	"kxyz-backend/internal/model"

	"gorm.io/datatypes"
)

type fakeAlertSettingStore struct {
	upserted model.AlertSetting
	getValue model.AlertSetting
	getErr   error
}

func (f *fakeAlertSettingStore) UpsertAlertSetting(_ context.Context, setting model.AlertSetting) error {
	f.upserted = setting
	return nil
}

func (f *fakeAlertSettingStore) GetAlertSettingByUserID(_ context.Context, _ string) (model.AlertSetting, error) {
	if f.getErr != nil {
		return model.AlertSetting{}, f.getErr
	}
	return f.getValue, nil
}

func TestAlertSettingServiceUpsertWithRulesJSON(t *testing.T) {
	store := &fakeAlertSettingStore{}
	svc := NewAlertSettingService(store)

	err := svc.UpsertAlertSetting(context.Background(), "user-1", UpsertAlertSettingInput{
		Email:         "a@example.com",
		GlobalEnabled: true,
		RulesJSON:     datatypes.JSON([]byte(`{"leftover":{"enabled":true,"max":30}}`)),
	})
	if err != nil {
		t.Fatalf("upsert alert setting failed: %v", err)
	}

	if store.upserted.UserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", store.upserted.UserID)
	}
	if !store.upserted.GlobalEnabled {
		t.Fatal("expected global_enabled true")
	}
	if string(store.upserted.RulesJSON) != `{"leftover":{"enabled":true,"max":30}}` {
		t.Fatalf("unexpected rules_json: %s", string(store.upserted.RulesJSON))
	}
}

func TestAlertSettingServiceUpsertDefaultsRulesJSON(t *testing.T) {
	store := &fakeAlertSettingStore{}
	svc := NewAlertSettingService(store)

	err := svc.UpsertAlertSetting(context.Background(), "user-1", UpsertAlertSettingInput{})
	if err != nil {
		t.Fatalf("upsert alert setting failed: %v", err)
	}

	if string(store.upserted.RulesJSON) != `{}` {
		t.Fatalf("expected default rules_json {}, got %s", string(store.upserted.RulesJSON))
	}
}

func TestAlertSettingServiceGetRejectsEmptyUserID(t *testing.T) {
	store := &fakeAlertSettingStore{}
	svc := NewAlertSettingService(store)

	_, err := svc.GetAlertSetting(context.Background(), " ")
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

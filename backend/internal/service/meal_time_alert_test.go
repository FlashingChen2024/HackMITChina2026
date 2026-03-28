package service

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/datatypes"
)

type fakeMealTimeAlertSettingStore struct {
	items []model.AlertSetting
}

func (f *fakeMealTimeAlertSettingStore) ListEnabledAlertSettings(_ context.Context) ([]model.AlertSetting, error) {
	return f.items, nil
}

type fakeMealTimeAlertMealStore struct {
	exists bool
}

func (f *fakeMealTimeAlertMealStore) ExistsMealInWindow(_ context.Context, _ string, _, _ time.Time) (bool, error) {
	return f.exists, nil
}

type fakeMealTimeNotifier struct {
	calls int
	to    string
}

func (f *fakeMealTimeNotifier) Notify(_ context.Context, to string, _ string, _ string) error {
	f.calls++
	f.to = to
	return nil
}

func TestMealTimeAlertServiceLogsLunchMissedWarning(t *testing.T) {
	var buf bytes.Buffer
	logger := log.New(&buf, "", 0)

	settingStore := &fakeMealTimeAlertSettingStore{
		items: []model.AlertSetting{
			{
				UserID:        "user-1",
				Email:         "meal@example.com",
				GlobalEnabled: true,
				RulesJSON: datatypes.JSON([]byte(`{
					"meal_times":{
						"enabled":true,
						"lunch":{"start":"11:30","end":"11:35"}
					}
				}`)),
			},
		},
	}
	mealStore := &fakeMealTimeAlertMealStore{exists: false}
	notifier := &fakeMealTimeNotifier{}
	svc := NewMealTimeAlertService(settingStore, mealStore, logger, notifier)
	svc.now = func() time.Time {
		return time.Date(2026, 3, 28, 11, 36, 20, 0, time.Local)
	}

	if err := svc.ScanAndAlert(context.Background()); err != nil {
		t.Fatalf("scan and alert failed: %v", err)
	}

	if !strings.Contains(buf.String(), "忘吃午饭") {
		t.Fatalf("expected missed lunch warning log, got %s", buf.String())
	}
	if notifier.calls != 1 || notifier.to != "meal@example.com" {
		t.Fatalf("expected one smtp call to meal@example.com, got calls=%d to=%s", notifier.calls, notifier.to)
	}
}

func TestMealTimeAlertServiceSkipsWhenMealExists(t *testing.T) {
	var buf bytes.Buffer
	logger := log.New(&buf, "", 0)

	settingStore := &fakeMealTimeAlertSettingStore{
		items: []model.AlertSetting{
			{
				UserID:        "user-1",
				GlobalEnabled: true,
				RulesJSON: datatypes.JSON([]byte(`{
					"meal_times":{
						"enabled":true,
						"lunch":{"start":"11:30","end":"11:35"}
					}
				}`)),
			},
		},
	}
	mealStore := &fakeMealTimeAlertMealStore{exists: true}
	svc := NewMealTimeAlertService(settingStore, mealStore, logger)
	svc.now = func() time.Time {
		return time.Date(2026, 3, 28, 11, 36, 0, 0, time.Local)
	}

	if err := svc.ScanAndAlert(context.Background()); err != nil {
		t.Fatalf("scan and alert failed: %v", err)
	}
	if buf.String() != "" {
		t.Fatalf("expected no warning log, got %s", buf.String())
	}
}

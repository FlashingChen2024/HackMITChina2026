package service

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"

	"kxyz-backend/internal/model"

	"gorm.io/datatypes"
	"gorm.io/gorm"
)

type fakeAlertSettingReader struct {
	value model.AlertSetting
	err   error
}

type fakeAlertNotifier struct {
	to      string
	subject string
	body    string
	calls   int
}

func (f *fakeAlertNotifier) Notify(_ context.Context, to string, subject string, body string) error {
	f.calls++
	f.to = to
	f.subject = subject
	f.body = body
	return nil
}

func (f *fakeAlertSettingReader) GetAlertSetting(_ context.Context, _ string) (model.AlertSetting, error) {
	if f.err != nil {
		return model.AlertSetting{}, f.err
	}
	return f.value, nil
}

func TestRuleBasedMealAlertCheckerLogsSpeedMaxWarning(t *testing.T) {
	var buf bytes.Buffer
	logger := log.New(&buf, "", 0)
	notifier := &fakeAlertNotifier{}
	checker := NewRuleBasedMealAlertChecker(&fakeAlertSettingReader{
		value: model.AlertSetting{
			Email:         "user@example.com",
			GlobalEnabled: true,
			RulesJSON:     datatypes.JSON([]byte(`{"speed":{"enabled":true,"max":10}}`)),
		},
	}, logger, notifier)

	err := checker.CheckMealAlerts(context.Background(), "meal-1", "老陈", MealAlertMetrics{
		DurationMinutes: 1,
		TotalIntakeG:    50,
		SpeedGPerMin:    50,
	})
	if err != nil {
		t.Fatalf("check meal alerts failed: %v", err)
	}

	logText := buf.String()
	if !strings.Contains(logText, "【警告】用户老陈用餐速度 50.0g/min，超过阈值上限 10.0g/min！") {
		t.Fatalf("unexpected warning log: %s", logText)
	}
	if notifier.calls != 1 || notifier.to != "user@example.com" {
		t.Fatalf("expected smtp notify once to user@example.com, got calls=%d to=%s", notifier.calls, notifier.to)
	}
}

func TestRuleBasedMealAlertCheckerIgnoresNotFound(t *testing.T) {
	checker := NewRuleBasedMealAlertChecker(&fakeAlertSettingReader{err: gorm.ErrRecordNotFound}, log.Default())
	if err := checker.CheckMealAlerts(context.Background(), "meal-1", "user-1", MealAlertMetrics{SpeedGPerMin: 50}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
}

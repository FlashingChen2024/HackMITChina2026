package service

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"kxyz-backend/internal/model"
)

type MealTimeAlertSettingStore interface {
	ListEnabledAlertSettings(ctx context.Context) ([]model.AlertSetting, error)
}

type MealTimeAlertMealStore interface {
	ExistsMealInWindow(ctx context.Context, userID string, start time.Time, end time.Time) (bool, error)
}

type MealTimeAlertService struct {
	settingStore MealTimeAlertSettingStore
	mealStore    MealTimeAlertMealStore
	logger       *log.Logger
	notifier     AlertNotifier
	now          func() time.Time
}

type mealTimeWindow struct {
	Start string `json:"start"`
	End   string `json:"end"`
}

type mealTimesRule struct {
	Enabled   bool           `json:"enabled"`
	Breakfast mealTimeWindow `json:"breakfast"`
	Lunch     mealTimeWindow `json:"lunch"`
	Dinner    mealTimeWindow `json:"dinner"`
}

type mealRulesPayload struct {
	MealTimes mealTimesRule `json:"meal_times"`
}

func NewMealTimeAlertService(
	settingStore MealTimeAlertSettingStore,
	mealStore MealTimeAlertMealStore,
	logger *log.Logger,
	notifier ...AlertNotifier,
) *MealTimeAlertService {
	target := NewNoopAlertNotifier()
	if len(notifier) > 0 && notifier[0] != nil {
		target = notifier[0]
	}
	return &MealTimeAlertService{
		settingStore: settingStore,
		mealStore:    mealStore,
		logger:       logger,
		notifier:     target,
		now:          time.Now,
	}
}

func (s *MealTimeAlertService) ScanAndAlert(ctx context.Context) error {
	settings, err := s.settingStore.ListEnabledAlertSettings(ctx)
	if err != nil {
		return err
	}

	nowLocal := s.now().In(time.Local).Truncate(time.Minute)
	for _, setting := range settings {
		if !setting.GlobalEnabled {
			continue
		}

		var rules mealRulesPayload
		if err := json.Unmarshal(setting.RulesJSON, &rules); err != nil {
			continue
		}
		if !rules.MealTimes.Enabled {
			continue
		}

		if err := s.checkMealWindow(ctx, setting.UserID, setting.Email, "早餐", rules.MealTimes.Breakfast, nowLocal); err != nil {
			return err
		}
		if err := s.checkMealWindow(ctx, setting.UserID, setting.Email, "午饭", rules.MealTimes.Lunch, nowLocal); err != nil {
			return err
		}
		if err := s.checkMealWindow(ctx, setting.UserID, setting.Email, "晚饭", rules.MealTimes.Dinner, nowLocal); err != nil {
			return err
		}
	}

	return nil
}

func (s *MealTimeAlertService) checkMealWindow(
	ctx context.Context,
	userID string,
	email string,
	mealLabel string,
	window mealTimeWindow,
	nowLocal time.Time,
) error {
	if window.Start == "" || window.End == "" {
		return nil
	}

	startLocal, err := parseClockForDay(window.Start, nowLocal)
	if err != nil {
		return nil
	}
	endLocal, err := parseClockForDay(window.End, nowLocal)
	if err != nil {
		return nil
	}
	targetMinute := endLocal.Add(1 * time.Minute).Truncate(time.Minute)
	if !nowLocal.Equal(targetMinute) {
		return nil
	}

	exists, err := s.mealStore.ExistsMealInWindow(ctx, userID, startLocal.UTC(), endLocal.UTC())
	if err != nil {
		return err
	}
	if exists {
		return nil
	}

	s.logger.Printf(
		"【警告】用户%s忘吃%s：在%s-%s未检测到就餐记录",
		userID,
		mealLabel,
		window.Start,
		window.End,
	)
	message := fmt.Sprintf("用户%s忘吃%s：在%s-%s未检测到就餐记录。", userID, mealLabel, window.Start, window.End)
	if err := s.notifier.Notify(ctx, email, "K-XYZ 漏餐提醒", message); err != nil {
		s.logger.Printf("[SMTP发送失败] user_id=%s meal=%s err=%v", userID, mealLabel, err)
	}
	return nil
}

func parseClockForDay(clock string, day time.Time) (time.Time, error) {
	t, err := time.ParseInLocation("15:04", clock, time.Local)
	if err != nil {
		return time.Time{}, fmt.Errorf("parse clock: %w", err)
	}
	return time.Date(day.Year(), day.Month(), day.Day(), t.Hour(), t.Minute(), 0, 0, time.Local), nil
}

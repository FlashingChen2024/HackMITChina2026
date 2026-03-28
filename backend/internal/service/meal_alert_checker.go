package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type alertSettingReader interface {
	GetAlertSetting(ctx context.Context, userID string) (model.AlertSetting, error)
}

type RuleBasedMealAlertChecker struct {
	settings alertSettingReader
	logger   *log.Logger
	notifier AlertNotifier
}

func NewRuleBasedMealAlertChecker(
	settings alertSettingReader,
	logger *log.Logger,
	notifier ...AlertNotifier,
) *RuleBasedMealAlertChecker {
	target := NewNoopAlertNotifier()
	if len(notifier) > 0 && notifier[0] != nil {
		target = notifier[0]
	}
	return &RuleBasedMealAlertChecker{
		settings: settings,
		logger:   logger,
		notifier: target,
	}
}

type numericRule struct {
	Enabled bool     `json:"enabled"`
	Min     *float64 `json:"min"`
	Max     *float64 `json:"max"`
}

type mealAlertRules struct {
	Speed numericRule `json:"speed"`
}

func (c *RuleBasedMealAlertChecker) CheckMealAlerts(
	ctx context.Context,
	mealID string,
	userID string,
	metrics MealAlertMetrics,
) error {
	if c == nil || c.settings == nil || c.logger == nil {
		return nil
	}

	setting, err := c.settings.GetAlertSetting(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return err
	}
	if !setting.GlobalEnabled || len(setting.RulesJSON) == 0 {
		return nil
	}

	var rules mealAlertRules
	if err := json.Unmarshal(setting.RulesJSON, &rules); err != nil {
		return nil
	}

	if rules.Speed.Enabled && rules.Speed.Max != nil && metrics.SpeedGPerMin > *rules.Speed.Max {
		message := fmt.Sprintf(
			"用户%s用餐速度 %.1fg/min，超过阈值上限 %.1fg/min。",
			userID,
			metrics.SpeedGPerMin,
			*rules.Speed.Max,
		)
		c.logger.Printf(
			"【警告】用户%s用餐速度 %.1fg/min，超过阈值上限 %.1fg/min！ meal_id=%s",
			userID,
			metrics.SpeedGPerMin,
			*rules.Speed.Max,
			mealID,
		)
		if err := c.notifier.Notify(ctx, setting.Email, "K-XYZ 用餐速度告警", message); err != nil {
			c.logger.Printf("[SMTP发送失败] meal_id=%s user_id=%s err=%v", mealID, userID, err)
		}
	}
	if rules.Speed.Enabled && rules.Speed.Min != nil && metrics.SpeedGPerMin < *rules.Speed.Min {
		message := fmt.Sprintf(
			"用户%s用餐速度 %.1fg/min，低于阈值下限 %.1fg/min。",
			userID,
			metrics.SpeedGPerMin,
			*rules.Speed.Min,
		)
		c.logger.Printf(
			"【警告】用户%s用餐速度 %.1fg/min，低于阈值下限 %.1fg/min！ meal_id=%s",
			userID,
			metrics.SpeedGPerMin,
			*rules.Speed.Min,
			mealID,
		)
		if err := c.notifier.Notify(ctx, setting.Email, "K-XYZ 用餐速度告警", message); err != nil {
			c.logger.Printf("[SMTP发送失败] meal_id=%s user_id=%s err=%v", mealID, userID, err)
		}
	}
	return nil
}

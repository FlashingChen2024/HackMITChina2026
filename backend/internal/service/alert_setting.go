package service

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/datatypes"
)

type AlertSettingStore interface {
	UpsertAlertSetting(ctx context.Context, setting model.AlertSetting) error
	GetAlertSettingByUserID(ctx context.Context, userID string) (model.AlertSetting, error)
}

type UpsertAlertSettingInput struct {
	Email         string
	GlobalEnabled bool
	RulesJSON     datatypes.JSON
}

type AlertSettingService struct {
	store AlertSettingStore
	now   func() time.Time
}

func NewAlertSettingService(store AlertSettingStore) *AlertSettingService {
	return &AlertSettingService{
		store: store,
		now:   time.Now,
	}
}

func (s *AlertSettingService) UpsertAlertSetting(
	ctx context.Context,
	userID string,
	input UpsertAlertSettingInput,
) error {
	userID = strings.TrimSpace(userID)
	email := strings.TrimSpace(input.Email)
	if userID == "" {
		return ErrInvalidInput
	}

	setting := model.AlertSetting{
		UserID:        userID,
		Email:         email,
		GlobalEnabled: input.GlobalEnabled,
		RulesJSON:     normalizeRulesJSON(input.RulesJSON),
	}

	return s.store.UpsertAlertSetting(ctx, setting)
}

func (s *AlertSettingService) GetAlertSetting(ctx context.Context, userID string) (model.AlertSetting, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return model.AlertSetting{}, ErrInvalidInput
	}

	return s.store.GetAlertSettingByUserID(ctx, userID)
}

func normalizeRulesJSON(raw datatypes.JSON) datatypes.JSON {
	if len(raw) == 0 {
		return datatypes.JSON([]byte(`{}`))
	}
	if !json.Valid(raw) {
		return datatypes.JSON([]byte(`{}`))
	}
	return raw
}

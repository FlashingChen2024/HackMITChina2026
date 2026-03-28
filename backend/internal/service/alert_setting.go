package service

import (
	"context"
	"strings"
	"time"

	"kxyz-backend/internal/model"
)

type AlertSettingStore interface {
	UpsertAlertSetting(ctx context.Context, setting model.AlertSetting) error
	GetAlertSettingByUserID(ctx context.Context, userID string) (model.AlertSetting, error)
}

type UpsertAlertSettingInput struct {
	Email   string
	Enabled bool
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
		UserID:  userID,
		Email:   email,
		Enabled: input.Enabled,
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

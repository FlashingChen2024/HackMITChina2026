package service

import (
	"context"
	"strings"
	"time"

	"kxyz-backend/internal/model"
)

type UserProfileStore interface {
	UpsertUserProfile(ctx context.Context, profile model.UserProfile) error
	GetUserProfileByUserID(ctx context.Context, userID string) (model.UserProfile, error)
}

type UpsertUserProfileInput struct {
	HeightCM int
	WeightKG float64
	Gender   string
	Age      int
}

type UserProfileService struct {
	store UserProfileStore
	now   func() time.Time
}

func NewUserProfileService(store UserProfileStore) *UserProfileService {
	return &UserProfileService{
		store: store,
		now:   time.Now,
	}
}

func (s *UserProfileService) UpsertUserProfile(
	ctx context.Context,
	userID string,
	input UpsertUserProfileInput,
) error {
	userID = strings.TrimSpace(userID)
	gender := strings.TrimSpace(input.Gender)
	if userID == "" || gender == "" || input.HeightCM <= 0 || input.WeightKG <= 0 || input.Age <= 0 {
		return ErrInvalidInput
	}

	profile := model.UserProfile{
		UserID:    userID,
		HeightCM:  input.HeightCM,
		WeightKG:  input.WeightKG,
		Gender:    gender,
		Age:       input.Age,
		UpdatedAt: s.now().UTC(),
	}

	return s.store.UpsertUserProfile(ctx, profile)
}

func (s *UserProfileService) GetUserProfile(ctx context.Context, userID string) (model.UserProfile, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return model.UserProfile{}, ErrInvalidInput
	}

	return s.store.GetUserProfileByUserID(ctx, userID)
}

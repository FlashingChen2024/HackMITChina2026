package service

import (
	"context"
	"testing"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type fakeUserProfileStore struct {
	profiles  map[string]model.UserProfile
	upsertErr error
	getErr    error
}

func newFakeUserProfileStore() *fakeUserProfileStore {
	return &fakeUserProfileStore{
		profiles: make(map[string]model.UserProfile),
	}
}

func (s *fakeUserProfileStore) UpsertUserProfile(_ context.Context, profile model.UserProfile) error {
	if s.upsertErr != nil {
		return s.upsertErr
	}
	s.profiles[profile.UserID] = profile
	return nil
}

func (s *fakeUserProfileStore) GetUserProfileByUserID(_ context.Context, userID string) (model.UserProfile, error) {
	if s.getErr != nil {
		return model.UserProfile{}, s.getErr
	}
	profile, ok := s.profiles[userID]
	if !ok {
		return model.UserProfile{}, gorm.ErrRecordNotFound
	}
	return profile, nil
}

func TestUserProfileServiceUpsertAndGet(t *testing.T) {
	store := newFakeUserProfileStore()
	svc := NewUserProfileService(store)

	err := svc.UpsertUserProfile(context.Background(), "user-1", UpsertUserProfileInput{
		HeightCM: 165,
		WeightKG: 45.0,
		Gender:   "female",
		Age:      18,
	})
	if err != nil {
		t.Fatalf("upsert user profile failed: %v", err)
	}

	got, err := svc.GetUserProfile(context.Background(), "user-1")
	if err != nil {
		t.Fatalf("get user profile failed: %v", err)
	}
	if got.UserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", got.UserID)
	}
	if got.HeightCM != 165 || got.WeightKG != 45.0 || got.Gender != "female" || got.Age != 18 {
		t.Fatalf("unexpected profile data: %+v", got)
	}
}

func TestUserProfileServiceUpsertRejectsInvalidInput(t *testing.T) {
	store := newFakeUserProfileStore()
	svc := NewUserProfileService(store)

	err := svc.UpsertUserProfile(context.Background(), "", UpsertUserProfileInput{
		HeightCM: 165,
		WeightKG: 45.0,
		Gender:   "female",
		Age:      18,
	})
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput for empty user_id, got %v", err)
	}

	err = svc.UpsertUserProfile(context.Background(), "user-1", UpsertUserProfileInput{
		HeightCM: 0,
		WeightKG: 45.0,
		Gender:   "female",
		Age:      18,
	})
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput for zero height, got %v", err)
	}
}

func TestUserProfileServiceGetRejectsEmptyUserID(t *testing.T) {
	store := newFakeUserProfileStore()
	svc := NewUserProfileService(store)

	_, err := svc.GetUserProfile(context.Background(), " ")
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

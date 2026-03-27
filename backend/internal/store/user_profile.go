package store

import (
	"context"
	"fmt"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type GormUserProfileStore struct {
	db *gorm.DB
}

func NewGormUserProfileStore(db *gorm.DB) *GormUserProfileStore {
	return &GormUserProfileStore{db: db}
}

func (s *GormUserProfileStore) UpsertUserProfile(ctx context.Context, profile model.UserProfile) error {
	now := time.Now().UTC()
	if profile.CreatedAt.IsZero() {
		profile.CreatedAt = now
	}
	profile.UpdatedAt = now

	if err := s.db.WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "user_id"}},
			DoUpdates: clause.Assignments(map[string]any{
				"height_cm":  profile.HeightCM,
				"weight_kg":  profile.WeightKG,
				"gender":     profile.Gender,
				"age":        profile.Age,
				"updated_at": now,
			}),
		}).
		Create(&profile).Error; err != nil {
		return fmt.Errorf("upsert user profile: %w", err)
	}

	return nil
}

func (s *GormUserProfileStore) GetUserProfileByUserID(ctx context.Context, userID string) (model.UserProfile, error) {
	var profile model.UserProfile
	if err := s.db.WithContext(ctx).
		Where("user_id = ?", userID).
		First(&profile).Error; err != nil {
		return model.UserProfile{}, fmt.Errorf("get user profile by user id: %w", err)
	}
	return profile, nil
}

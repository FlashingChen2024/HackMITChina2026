package store

import (
	"context"
	"fmt"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type GormUserStore struct {
	db *gorm.DB
}

func NewGormUserStore(db *gorm.DB) *GormUserStore {
	return &GormUserStore{db: db}
}

func (s *GormUserStore) CreateUser(ctx context.Context, user model.User) error {
	if err := s.db.WithContext(ctx).Create(&user).Error; err != nil {
		return fmt.Errorf("create user: %w", err)
	}
	return nil
}

func (s *GormUserStore) GetUserByUsername(ctx context.Context, username string) (model.User, error) {
	var user model.User
	if err := s.db.WithContext(ctx).Where("username = ?", username).First(&user).Error; err != nil {
		return model.User{}, fmt.Errorf("get user by username: %w", err)
	}
	return user, nil
}

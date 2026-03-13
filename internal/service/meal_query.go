package service

import (
	"context"
	"time"

	"kxyz-backend/internal/model"
)

const MealListPageSize = 20

type MealQueryStore interface {
	ListMeals(ctx context.Context, cursor *time.Time, limit int) ([]model.Meal, error)
	GetMealByID(ctx context.Context, mealID string) (model.Meal, error)
	ListMealTrajectory(ctx context.Context, mealID string, lastTimestamp *time.Time) ([]model.MealCurveData, error)
}

type MealQueryService struct {
	store MealQueryStore
}

func NewMealQueryService(store MealQueryStore) *MealQueryService {
	return &MealQueryService{store: store}
}

func (s *MealQueryService) ListMeals(ctx context.Context, cursor *time.Time) ([]model.Meal, error) {
	return s.store.ListMeals(ctx, cursor, MealListPageSize)
}

func (s *MealQueryService) GetMealByID(ctx context.Context, mealID string) (model.Meal, error) {
	return s.store.GetMealByID(ctx, mealID)
}

func (s *MealQueryService) GetMealTrajectory(
	ctx context.Context,
	mealID string,
	lastTimestamp *time.Time,
) ([]model.MealCurveData, error) {
	return s.store.ListMealTrajectory(ctx, mealID, lastTimestamp)
}

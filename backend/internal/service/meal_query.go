package service

import (
	"context"
	"strings"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

const MealListPageSize = 20

type MealQueryStore interface {
	ListMeals(ctx context.Context, userID string, cursor *time.Time, limit int) ([]model.Meal, error)
	GetMealByID(ctx context.Context, userID string, mealID string) (model.Meal, error)
	ListMealGrids(ctx context.Context, mealID string) ([]model.MealGrid, error)
	UpdateMealGridFood(ctx context.Context, mealID string, gridIndex int, foodName string, unitCalPer100G float64) error
	ListMealTrajectory(
		ctx context.Context,
		userID string,
		mealID string,
		lastTimestamp *time.Time,
	) ([]model.MealCurveData, error)
	AggregateDailyStatistics(ctx context.Context, userID string, startDate time.Time, endDate time.Time) ([]model.DailyStatisticsRow, error)
}

type MealQueryService struct {
	store MealQueryStore
}

func NewMealQueryService(store MealQueryStore) *MealQueryService {
	return &MealQueryService{store: store}
}

func (s *MealQueryService) ListMeals(ctx context.Context, userID string, cursor *time.Time) ([]model.Meal, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return nil, ErrInvalidInput
	}

	return s.store.ListMeals(ctx, userID, cursor, MealListPageSize)
}

func (s *MealQueryService) GetMealByID(ctx context.Context, userID string, mealID string) (model.Meal, error) {
	userID = strings.TrimSpace(userID)
	mealID = strings.TrimSpace(mealID)
	if userID == "" || mealID == "" {
		return model.Meal{}, ErrInvalidInput
	}
	return s.store.GetMealByID(ctx, userID, mealID)
}

func (s *MealQueryService) GetMealDetail(
	ctx context.Context,
	userID string,
	mealID string,
) (model.Meal, []model.MealGrid, error) {
	userID = strings.TrimSpace(userID)
	mealID = strings.TrimSpace(mealID)
	if userID == "" || mealID == "" {
		return model.Meal{}, nil, ErrInvalidInput
	}

	meal, err := s.store.GetMealByID(ctx, userID, mealID)
	if err != nil {
		return model.Meal{}, nil, err
	}

	grids, err := s.store.ListMealGrids(ctx, mealID)
	if err != nil {
		return model.Meal{}, nil, err
	}

	return meal, grids, nil
}

func (s *MealQueryService) AttachFoods(
	ctx context.Context,
	userID string,
	mealID string,
	grids []model.MealGrid,
) error {
	userID = strings.TrimSpace(userID)
	mealID = strings.TrimSpace(mealID)
	if userID == "" || mealID == "" || len(grids) == 0 {
		return ErrInvalidInput
	}

	if _, err := s.store.GetMealByID(ctx, userID, mealID); err != nil {
		return err
	}

	existingGrids, err := s.store.ListMealGrids(ctx, mealID)
	if err != nil {
		return err
	}
	if len(existingGrids) == 0 {
		return gorm.ErrRecordNotFound
	}

	existingByIndex := make(map[int]struct{}, len(existingGrids))
	for _, grid := range existingGrids {
		existingByIndex[grid.GridIndex] = struct{}{}
	}

	seen := make(map[int]struct{}, len(grids))
	for _, grid := range grids {
		if grid.GridIndex < 1 || grid.GridIndex > 4 {
			return ErrInvalidInput
		}
		foodName := strings.TrimSpace(grid.FoodName)
		if foodName == "" || grid.UnitCalPer100G < 0 {
			return ErrInvalidInput
		}
		if _, ok := seen[grid.GridIndex]; ok {
			return ErrInvalidInput
		}
		if _, ok := existingByIndex[grid.GridIndex]; !ok {
			return gorm.ErrRecordNotFound
		}
		seen[grid.GridIndex] = struct{}{}
	}

	for _, grid := range grids {
		if err := s.store.UpdateMealGridFood(
			ctx,
			mealID,
			grid.GridIndex,
			strings.TrimSpace(grid.FoodName),
			grid.UnitCalPer100G,
		); err != nil {
			return err
		}
	}

	return nil
}

func (s *MealQueryService) GetMealTrajectory(
	ctx context.Context,
	userID string,
	mealID string,
	lastTimestamp *time.Time,
) ([]model.MealCurveData, error) {
	userID = strings.TrimSpace(userID)
	mealID = strings.TrimSpace(mealID)
	if userID == "" || mealID == "" {
		return nil, ErrInvalidInput
	}

	return s.store.ListMealTrajectory(ctx, userID, mealID, lastTimestamp)
}

func (s *MealQueryService) AggregateDailyStatistics(
	ctx context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" || endDate.Before(startDate) {
		return nil, ErrInvalidInput
	}

	return s.store.AggregateDailyStatistics(ctx, userID, startDate, endDate)
}

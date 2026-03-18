package service

import (
	"context"
	"testing"
	"time"

	"kxyz-backend/internal/model"
)

type fakeMealQueryStore struct {
	meals      []model.Meal
	trajectory []model.MealCurveData
	meal       model.Meal
	grids      []model.MealGrid
	statsRows  []model.DailyStatisticsRow

	err       error
	gridsErr  error
	statsErr  error
	updateErr error

	lastCursor *time.Time
	lastLimit  int
	lastMealID string
	lastTS     *time.Time
	lastUserID string
	lastStart  time.Time
	lastEnd    time.Time

	updateCalls         int
	lastUpdateMealID    string
	lastUpdateGridIndex int
	lastUpdateFoodName  string
	lastUpdateUnitCal   float64
}

func (f *fakeMealQueryStore) ListMeals(_ context.Context, cursor *time.Time, limit int) ([]model.Meal, error) {
	f.lastCursor = cursor
	f.lastLimit = limit
	return f.meals, f.err
}

func (f *fakeMealQueryStore) GetMealByID(_ context.Context, mealID string) (model.Meal, error) {
	f.lastMealID = mealID
	return f.meal, f.err
}

func (f *fakeMealQueryStore) ListMealGrids(_ context.Context, mealID string) ([]model.MealGrid, error) {
	f.lastMealID = mealID
	if f.gridsErr != nil {
		return nil, f.gridsErr
	}
	return f.grids, nil
}

func (f *fakeMealQueryStore) UpdateMealGridFood(
	_ context.Context,
	mealID string,
	gridIndex int,
	foodName string,
	unitCalPer100G float64,
) error {
	f.updateCalls++
	f.lastUpdateMealID = mealID
	f.lastUpdateGridIndex = gridIndex
	f.lastUpdateFoodName = foodName
	f.lastUpdateUnitCal = unitCalPer100G
	return f.updateErr
}

func (f *fakeMealQueryStore) ListMealTrajectory(_ context.Context, mealID string, lastTimestamp *time.Time) ([]model.MealCurveData, error) {
	f.lastMealID = mealID
	f.lastTS = lastTimestamp
	return f.trajectory, f.err
}

func (f *fakeMealQueryStore) AggregateDailyStatistics(
	_ context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	f.lastUserID = userID
	f.lastStart = startDate
	f.lastEnd = endDate
	return f.statsRows, f.statsErr
}

func TestMealQueryServiceUsesCursorPagination(t *testing.T) {
	store := &fakeMealQueryStore{}
	svc := NewMealQueryService(store)
	cursor := time.Date(2026, 3, 13, 9, 0, 0, 0, time.UTC)

	if _, err := svc.ListMeals(context.Background(), &cursor); err != nil {
		t.Fatalf("list meals failed: %v", err)
	}

	if store.lastLimit != MealListPageSize {
		t.Fatalf("expected limit=%d, got %d", MealListPageSize, store.lastLimit)
	}
	if store.lastCursor == nil || !store.lastCursor.Equal(cursor) {
		t.Fatalf("expected cursor forwarded")
	}
}

func TestMealQueryServiceGetByID(t *testing.T) {
	store := &fakeMealQueryStore{}
	svc := NewMealQueryService(store)

	if _, err := svc.GetMealByID(context.Background(), "meal-1"); err != nil {
		t.Fatalf("get meal by id failed: %v", err)
	}
	if store.lastMealID != "meal-1" {
		t.Fatalf("expected meal id meal-1, got %s", store.lastMealID)
	}
}

func TestMealQueryServiceGetDetail(t *testing.T) {
	store := &fakeMealQueryStore{
		meal: model.Meal{MealID: "meal-1"},
		grids: []model.MealGrid{
			{MealID: "meal-1", GridIndex: 1},
			{MealID: "meal-1", GridIndex: 2},
		},
	}
	svc := NewMealQueryService(store)

	meal, grids, err := svc.GetMealDetail(context.Background(), "meal-1")
	if err != nil {
		t.Fatalf("get meal detail failed: %v", err)
	}
	if meal.MealID != "meal-1" {
		t.Fatalf("expected meal_id=meal-1, got %s", meal.MealID)
	}
	if len(grids) != 2 {
		t.Fatalf("expected 2 grids, got %d", len(grids))
	}
}

func TestMealQueryServiceAttachFoods(t *testing.T) {
	store := &fakeMealQueryStore{
		meal: model.Meal{MealID: "meal-1"},
		grids: []model.MealGrid{
			{MealID: "meal-1", GridIndex: 1},
			{MealID: "meal-1", GridIndex: 2},
		},
	}
	svc := NewMealQueryService(store)

	err := svc.AttachFoods(context.Background(), "meal-1", []model.MealGrid{
		{GridIndex: 1, FoodName: "rice", UnitCalPer100G: 116},
		{GridIndex: 2, FoodName: "egg", UnitCalPer100G: 80},
	})
	if err != nil {
		t.Fatalf("attach foods failed: %v", err)
	}
	if store.updateCalls != 2 {
		t.Fatalf("expected 2 updates, got %d", store.updateCalls)
	}
	if store.lastUpdateMealID != "meal-1" {
		t.Fatalf("expected update meal_id=meal-1, got %s", store.lastUpdateMealID)
	}
}

func TestMealQueryServiceAttachFoodsRejectsDuplicateGrid(t *testing.T) {
	store := &fakeMealQueryStore{
		meal: model.Meal{MealID: "meal-1"},
		grids: []model.MealGrid{
			{MealID: "meal-1", GridIndex: 1},
		},
	}
	svc := NewMealQueryService(store)

	err := svc.AttachFoods(context.Background(), "meal-1", []model.MealGrid{
		{GridIndex: 1, FoodName: "rice", UnitCalPer100G: 116},
		{GridIndex: 1, FoodName: "rice-2", UnitCalPer100G: 116},
	})
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestMealQueryServiceGetTrajectory(t *testing.T) {
	store := &fakeMealQueryStore{}
	svc := NewMealQueryService(store)
	last := time.Date(2026, 3, 13, 10, 0, 0, 0, time.UTC)

	if _, err := svc.GetMealTrajectory(context.Background(), "meal-1", &last); err != nil {
		t.Fatalf("get meal trajectory failed: %v", err)
	}
	if store.lastMealID != "meal-1" {
		t.Fatalf("expected meal id meal-1, got %s", store.lastMealID)
	}
	if store.lastTS == nil || !store.lastTS.Equal(last) {
		t.Fatalf("expected last timestamp forwarded")
	}
}

func TestMealQueryServiceAggregateDailyStatistics(t *testing.T) {
	start := time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC)
	end := time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC)
	store := &fakeMealQueryStore{
		statsRows: []model.DailyStatisticsRow{
			{Date: "2026-03-01", DailyServedG: 600, DailyIntakeG: 500, DailyCalories: 750.5, AvgSpeedGPerMin: 15.2},
		},
	}
	svc := NewMealQueryService(store)

	rows, err := svc.AggregateDailyStatistics(context.Background(), "user-1", start, end)
	if err != nil {
		t.Fatalf("aggregate daily statistics failed: %v", err)
	}
	if len(rows) != 1 {
		t.Fatalf("expected 1 row, got %d", len(rows))
	}
	if store.lastUserID != "user-1" {
		t.Fatalf("expected user_id user-1, got %s", store.lastUserID)
	}
	if !store.lastStart.Equal(start) || !store.lastEnd.Equal(end) {
		t.Fatalf("expected date range forwarded")
	}
}

func TestMealQueryServiceAggregateDailyStatisticsRejectsInvalidInput(t *testing.T) {
	svc := NewMealQueryService(&fakeMealQueryStore{})

	_, err := svc.AggregateDailyStatistics(
		context.Background(),
		"",
		time.Date(2026, 3, 3, 0, 0, 0, 0, time.UTC),
		time.Date(2026, 3, 1, 0, 0, 0, 0, time.UTC),
	)
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

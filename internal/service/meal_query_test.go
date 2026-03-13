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
	err        error
	lastCursor *time.Time
	lastLimit  int
	lastMealID string
	lastTS     *time.Time
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

func (f *fakeMealQueryStore) ListMealTrajectory(_ context.Context, mealID string, lastTimestamp *time.Time) ([]model.MealCurveData, error) {
	f.lastMealID = mealID
	f.lastTS = lastTimestamp
	return f.trajectory, f.err
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

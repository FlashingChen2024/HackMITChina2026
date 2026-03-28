package service

import (
	"context"
	"errors"
	"testing"
)

type fakeFoodCalorieGenerator struct {
	response string
	err      error
}

func (f *fakeFoodCalorieGenerator) GenerateWithSystemPrompt(
	_ context.Context,
	_ string,
	_ string,
) (string, error) {
	if f.err != nil {
		return "", f.err
	}
	return f.response, nil
}

func TestLLMFoodLibrarySearchUsesLLMAndCachesCode(t *testing.T) {
	library := NewLLMFoodLibrary(
		NewStaticFoodLibrary(),
		&fakeFoodCalorieGenerator{
			response: "```json\n{\"matches\":[{\"food_name_cn\":\"三明治\",\"food_name_en\":\"Sandwich\",\"default_unit_cal_per_100g\":250}]}\n```",
		},
	)

	items, err := library.Search(context.Background(), "三明治")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected one item, got %d", len(items))
	}
	if items[0].FoodNameCN != "三明治" {
		t.Fatalf("unexpected food name: %s", items[0].FoodNameCN)
	}
	if items[0].DefaultUnitCalPer100G != 250 {
		t.Fatalf("unexpected calories: %v", items[0].DefaultUnitCalPer100G)
	}
	if items[0].FoodCode == "" {
		t.Fatalf("expected generated food code")
	}

	found, err := library.FindByCode(context.Background(), items[0].FoodCode)
	if err != nil {
		t.Fatalf("find by code failed: %v", err)
	}
	if found.FoodNameCN != "三明治" {
		t.Fatalf("expected cached item, got %+v", found)
	}
}

func TestLLMFoodLibrarySearchFallsBackOnGeneratorError(t *testing.T) {
	library := NewLLMFoodLibrary(
		NewStaticFoodLibrary(),
		&fakeFoodCalorieGenerator{err: errors.New("upstream failed")},
	)

	items, err := library.Search(context.Background(), "炸鸡")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(items) == 0 || items[0].FoodCode != "FD001" {
		t.Fatalf("expected static fallback FD001, got %+v", items)
	}
}

func TestLLMFoodLibrarySearchFallsBackOnInvalidLLMResponse(t *testing.T) {
	library := NewLLMFoodLibrary(
		NewStaticFoodLibrary(),
		&fakeFoodCalorieGenerator{response: "not-json"},
	)

	items, err := library.Search(context.Background(), "汉堡")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(items) == 0 || items[0].FoodCode != "FD002" {
		t.Fatalf("expected static fallback FD002, got %+v", items)
	}
}

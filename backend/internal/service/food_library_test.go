package service

import (
	"context"
	"testing"
)

func TestStaticFoodLibrarySearch(t *testing.T) {
	library := NewStaticFoodLibrary()

	items, err := library.Search(context.Background(), "炸鸡")
	if err != nil {
		t.Fatalf("search failed: %v", err)
	}
	if len(items) == 0 {
		t.Fatalf("expected at least one match")
	}
	if items[0].FoodCode != "FD001" {
		t.Fatalf("expected first code FD001, got %s", items[0].FoodCode)
	}
}

func TestStaticFoodLibraryFindByCode(t *testing.T) {
	library := NewStaticFoodLibrary()

	item, err := library.FindByCode(context.Background(), "fd001")
	if err != nil {
		t.Fatalf("find by code failed: %v", err)
	}
	if item.FoodNameCN != "炸鸡" {
		t.Fatalf("expected food name 炸鸡, got %s", item.FoodNameCN)
	}
	if item.DefaultUnitCalPer100G != 260.0 {
		t.Fatalf("unexpected calories: %v", item.DefaultUnitCalPer100G)
	}
}

func TestStaticFoodLibraryFindByCodeNotFound(t *testing.T) {
	library := NewStaticFoodLibrary()

	_, err := library.FindByCode(context.Background(), "FD999")
	if err != ErrFoodNotFound {
		t.Fatalf("expected ErrFoodNotFound, got %v", err)
	}
}

package service

import (
	"context"
	"errors"
	"sort"
	"strings"
)

var ErrFoodNotFound = errors.New("food not found")

type FoodLibraryItem struct {
	FoodCode              string
	FoodNameCN            string
	FoodNameEN            string
	DefaultUnitCalPer100G float64
}

type FoodLibrary interface {
	Search(ctx context.Context, keyword string) ([]FoodLibraryItem, error)
	FindByCode(ctx context.Context, foodCode string) (FoodLibraryItem, error)
}

type StaticFoodLibrary struct {
	items  []FoodLibraryItem
	byCode map[string]FoodLibraryItem
}

func NewStaticFoodLibrary() *StaticFoodLibrary {
	items := defaultFoodLibraryItems()
	byCode := make(map[string]FoodLibraryItem, len(items))
	for _, item := range items {
		byCode[strings.ToUpper(item.FoodCode)] = item
	}

	return &StaticFoodLibrary{
		items:  items,
		byCode: byCode,
	}
}

func (s *StaticFoodLibrary) Search(_ context.Context, keyword string) ([]FoodLibraryItem, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return nil, ErrInvalidInput
	}

	type scoredItem struct {
		item  FoodLibraryItem
		score int
	}
	scored := make([]scoredItem, 0, len(s.items))
	keywordLower := strings.ToLower(keyword)
	for _, item := range s.items {
		score := matchFoodScore(item, keyword, keywordLower)
		if score <= 0 {
			continue
		}
		scored = append(scored, scoredItem{
			item:  item,
			score: score,
		})
	}

	sort.Slice(scored, func(i int, j int) bool {
		if scored[i].score != scored[j].score {
			return scored[i].score > scored[j].score
		}
		return scored[i].item.FoodCode < scored[j].item.FoodCode
	})

	result := make([]FoodLibraryItem, 0, len(scored))
	for _, item := range scored {
		result = append(result, item.item)
	}
	return result, nil
}

func (s *StaticFoodLibrary) FindByCode(_ context.Context, foodCode string) (FoodLibraryItem, error) {
	foodCode = strings.ToUpper(strings.TrimSpace(foodCode))
	if foodCode == "" {
		return FoodLibraryItem{}, ErrInvalidInput
	}

	item, ok := s.byCode[foodCode]
	if !ok {
		return FoodLibraryItem{}, ErrFoodNotFound
	}
	return item, nil
}

func matchFoodScore(item FoodLibraryItem, keyword string, keywordLower string) int {
	score := 0
	if strings.EqualFold(item.FoodCode, keyword) {
		score += 100
	}
	if item.FoodNameCN == keyword {
		score += 90
	}
	if strings.EqualFold(item.FoodNameEN, keyword) {
		score += 80
	}
	if strings.Contains(strings.ToLower(item.FoodCode), keywordLower) {
		score += 40
	}
	if strings.Contains(item.FoodNameCN, keyword) {
		score += 30
	}
	if strings.Contains(strings.ToLower(item.FoodNameEN), keywordLower) {
		score += 20
	}
	return score
}

func defaultFoodLibraryItems() []FoodLibraryItem {
	return []FoodLibraryItem{
		{FoodCode: "FD001", FoodNameCN: "炸鸡", FoodNameEN: "Fried Chicken", DefaultUnitCalPer100G: 260.0},
		{FoodCode: "FD002", FoodNameCN: "汉堡", FoodNameEN: "Burger", DefaultUnitCalPer100G: 295.0},
		{FoodCode: "FD003", FoodNameCN: "薯条", FoodNameEN: "French Fries", DefaultUnitCalPer100G: 312.0},
		{FoodCode: "FD004", FoodNameCN: "米饭", FoodNameEN: "Rice", DefaultUnitCalPer100G: 116.0},
		{FoodCode: "FD005", FoodNameCN: "西红柿炒鸡蛋", FoodNameEN: "Scrambled Eggs with Tomato", DefaultUnitCalPer100G: 80.0},
		{FoodCode: "FD006", FoodNameCN: "鸡胸肉", FoodNameEN: "Chicken Breast", DefaultUnitCalPer100G: 165.0},
		{FoodCode: "FD007", FoodNameCN: "生菜沙拉", FoodNameEN: "Lettuce Salad", DefaultUnitCalPer100G: 18.0},
		{FoodCode: "FD008", FoodNameCN: "宫保鸡丁", FoodNameEN: "Kung Pao Chicken", DefaultUnitCalPer100G: 175.0},
	}
}

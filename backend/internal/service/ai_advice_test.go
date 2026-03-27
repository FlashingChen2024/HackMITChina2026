package service

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

type fakeAIAdviceStore struct {
	meal       model.Meal
	grids      []model.MealGrid
	profile    model.UserProfile
	todayTotal float64
	statsRows  []model.DailyStatisticsRow
	latestErr  error
	profileErr error
	todayErr   error
	statsErr   error
	lastUserID string
	todayStart time.Time
	todayEnd   time.Time
	statsStart time.Time
	statsEnd   time.Time
}

type fakeAITextGenerator struct {
	reply      string
	err        error
	lastPrompt string
}

func (f *fakeAITextGenerator) Generate(_ context.Context, prompt string) (string, error) {
	f.lastPrompt = prompt
	if f.err != nil {
		return "", f.err
	}
	return f.reply, nil
}

func (f *fakeAIAdviceStore) GetLatestMealWithGrids(
	_ context.Context,
	userID string,
) (model.Meal, []model.MealGrid, error) {
	f.lastUserID = userID
	if f.latestErr != nil {
		return model.Meal{}, nil, f.latestErr
	}
	return f.meal, f.grids, nil
}

func (f *fakeAIAdviceStore) SumTodayCalories(
	_ context.Context,
	userID string,
	start time.Time,
	end time.Time,
) (float64, error) {
	f.lastUserID = userID
	f.todayStart = start
	f.todayEnd = end
	if f.todayErr != nil {
		return 0, f.todayErr
	}
	return f.todayTotal, nil
}

func (f *fakeAIAdviceStore) GetUserProfileByUserID(
	_ context.Context,
	userID string,
) (model.UserProfile, error) {
	f.lastUserID = userID
	if f.profileErr != nil {
		return model.UserProfile{}, f.profileErr
	}
	if strings.TrimSpace(f.profile.UserID) == "" {
		return model.UserProfile{}, gorm.ErrRecordNotFound
	}
	return f.profile, nil
}

func (f *fakeAIAdviceStore) AggregateDailyStatistics(
	_ context.Context,
	userID string,
	startDate time.Time,
	endDate time.Time,
) ([]model.DailyStatisticsRow, error) {
	f.lastUserID = userID
	f.statsStart = startDate
	f.statsEnd = endDate
	if f.statsErr != nil {
		return nil, f.statsErr
	}
	return f.statsRows, nil
}

func TestAIAdviceBuildPromptMealReview(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 25},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "西红柿炒鸡蛋", IntakeG: 150, TotalCal: 180},
			{GridIndex: 2, FoodName: "米饭", IntakeG: 120, TotalCal: 150},
		},
		todayTotal: 800,
		statsRows: []model.DailyStatisticsRow{
			{Date: "2026-03-16", DailyCalories: 720, DailyIntakeG: 480, AvgSpeedGPerMin: 14},
			{Date: "2026-03-17", DailyCalories: 760, DailyIntakeG: 500, AvgSpeedGPerMin: 15},
			{Date: "2026-03-18", DailyCalories: 800, DailyIntakeG: 520, AvgSpeedGPerMin: 16},
		},
	}
	svc := NewAIAdviceService(store)
	svc.now = func() time.Time {
		return time.Date(2026, 3, 18, 9, 30, 0, 0, time.FixedZone("UTC+8", 8*3600))
	}

	prompt, err := svc.BuildPrompt(context.Background(), "user-1", AdviceTypeMealReview)
	if err != nil {
		t.Fatalf("build prompt failed: %v", err)
	}

	if !strings.Contains(prompt, "任务类型:meal_review") {
		t.Fatalf("expected meal_review type in prompt, got %s", prompt)
	}
	if !strings.Contains(prompt, "BasicPrompt") {
		t.Fatalf("expected basic prompt context when no profile, got %s", prompt)
	}
	if !strings.Contains(prompt, "营养评估模型参考《中国居民膳食营养素参考摄入量（DRIs）》") {
		t.Fatalf("expected DRI instruction in prompt, got %s", prompt)
	}
	if !strings.Contains(prompt, "西红柿炒鸡蛋") || !strings.Contains(prompt, "米饭") {
		t.Fatalf("expected food names in prompt, got %s", prompt)
	}
	if !strings.Contains(prompt, "800.0kcal") {
		t.Fatalf("expected today calories in prompt, got %s", prompt)
	}
	if store.lastUserID != "user-1" {
		t.Fatalf("expected user-1 forwarded, got %s", store.lastUserID)
	}
	if store.todayStart.Format(time.RFC3339) != "2026-03-18T00:00:00Z" ||
		store.todayEnd.Format(time.RFC3339) != "2026-03-19T00:00:00Z" {
		t.Fatalf("unexpected today window: %s - %s", store.todayStart, store.todayEnd)
	}
	if store.statsStart.Format("2006-01-02") != "2026-03-16" ||
		store.statsEnd.Format("2006-01-02") != "2026-03-18" {
		t.Fatalf("unexpected stats window: %s - %s", store.statsStart, store.statsEnd)
	}
}

func TestAIAdviceBuildPromptWithUserProfileUsesAdvancedPrompt(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 25},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "沙拉", IntakeG: 150, TotalCal: 180},
		},
		profile: model.UserProfile{
			UserID:   "user-1",
			HeightCM: 165,
			WeightKG: 45.0,
			Gender:   "女",
			Age:      18,
		},
		todayTotal: 300,
	}
	svc := NewAIAdviceService(store)

	prompt, err := svc.BuildPrompt(context.Background(), "user-1", AdviceTypeMealReview)
	if err != nil {
		t.Fatalf("build prompt failed: %v", err)
	}

	if !strings.Contains(prompt, "AdvancedPrompt") {
		t.Fatalf("expected advanced prompt context, got %s", prompt)
	}
	if !strings.Contains(prompt, "身高165cm、体重45.0kg、性别女、年龄18岁") {
		t.Fatalf("expected profile fields in prompt, got %s", prompt)
	}
}

func TestAIAdviceBuildPromptRejectsUnsupportedType(t *testing.T) {
	svc := NewAIAdviceService(&fakeAIAdviceStore{})

	_, err := svc.BuildPrompt(context.Background(), "user-1", "unknown")
	if err != ErrUnsupportedAdviceType {
		t.Fatalf("expected ErrUnsupportedAdviceType, got %v", err)
	}
}

func TestAIAdviceBuildPromptReturnsNoMealData(t *testing.T) {
	svc := NewAIAdviceService(&fakeAIAdviceStore{latestErr: gorm.ErrRecordNotFound})

	_, err := svc.BuildPrompt(context.Background(), "user-1", AdviceTypeMealReview)
	if err != ErrNoMealData {
		t.Fatalf("expected ErrNoMealData, got %v", err)
	}
}

func TestAIAdviceGenerateAdviceFromJSON(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 20},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "牛肉", IntakeG: 180, TotalCal: 320},
		},
		todayTotal: 1200,
	}
	gen := &fakeAITextGenerator{
		reply: `{"advice":"这餐蛋白不错，建议补点蔬菜。","is_alert":true}`,
	}
	svc := NewAIAdviceService(store, gen)

	result, err := svc.GenerateAdvice(context.Background(), "user-1", AdviceTypeDailyAlert)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}

	if result.Advice != "这餐蛋白不错，建议补点蔬菜。" {
		t.Fatalf("unexpected advice: %s", result.Advice)
	}
	if !result.IsAlert {
		t.Fatalf("expected is_alert true")
	}
	if result.Type != AdviceTypeDailyAlert {
		t.Fatalf("unexpected type: %s", result.Type)
	}
	if !strings.Contains(gen.lastPrompt, "DRIs") {
		t.Fatalf("expected prompt forwarded to model with DRI instruction, got %s", gen.lastPrompt)
	}
}

func TestAIAdviceGenerateAdviceFallbackInference(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 20},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "炸鸡", IntakeG: 180, TotalCal: 420},
		},
		todayTotal: 3000,
	}
	gen := &fakeAITextGenerator{
		reply: "存在明显超标风险，请立刻减少高油摄入。",
	}
	svc := NewAIAdviceService(store, gen)

	result, err := svc.GenerateAdvice(context.Background(), "user-1", AdviceTypeDailyAlert)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}
	if !result.IsAlert {
		t.Fatalf("expected fallback inference is_alert true")
	}
}

func TestParseModelJSONResultWithMarkdownFenceAndEscapedJSON(t *testing.T) {
	raw := "```json\n{\\\"advice\\\":\\\"您这两分钟吃得跟抢的一样！建议放慢速度，还能及时收到\\\"吃饱\\\"的信号哦~\\\",\\\"is_alert\\\":true}\n```"

	advice, isAlert, ok := parseModelJSONResult(raw)
	if !ok {
		t.Fatalf("expected parser to recover from fenced escaped JSON")
	}
	if !isAlert {
		t.Fatalf("expected parsed is_alert true")
	}
	if !strings.Contains(advice, "吃饱") {
		t.Fatalf("expected parsed advice to contain inner quoted phrase, got %s", advice)
	}
}

func TestParseModelJSONResultWithInvalidJSONButRecognizablePattern(t *testing.T) {
	raw := "{\"advice\":\"还能及时收到\"吃饱\"的信号哦~\",\"is_alert\":true}"

	advice, isAlert, ok := parseModelJSONResult(raw)
	if !ok {
		t.Fatalf("expected parser to recover from non-strict json")
	}
	if !isAlert {
		t.Fatalf("expected parsed is_alert true")
	}
	if advice != "还能及时收到\"吃饱\"的信号哦~" {
		t.Fatalf("unexpected parsed advice: %s", advice)
	}
}

func TestAIAdviceGenerateAdviceFallbackWhenGeneratorUnavailable(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 20},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "炸鸡", IntakeG: 180, TotalCal: 420},
		},
		todayTotal: 3000,
	}
	svc := NewAIAdviceService(store)

	result, err := svc.GenerateAdvice(context.Background(), "user-1", AdviceTypeMealReview)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}
	if strings.TrimSpace(result.Advice) == "" {
		t.Fatalf("expected fallback advice")
	}
	if result.Type != AdviceTypeMealReview {
		t.Fatalf("unexpected type: %s", result.Type)
	}
}

func TestAIAdviceGenerateAdviceFallbackWhenGeneratorErrors(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-1", DurationMinutes: 20},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "炸鸡", IntakeG: 180, TotalCal: 420},
		},
		todayTotal: 3000,
	}
	gen := &fakeAITextGenerator{err: errors.New("upstream timeout")}
	svc := NewAIAdviceService(store, gen)

	result, err := svc.GenerateAdvice(context.Background(), "user-1", AdviceTypeDailyAlert)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}
	if strings.TrimSpace(result.Advice) == "" {
		t.Fatalf("expected fallback advice")
	}
	if !result.IsAlert {
		t.Fatalf("expected fallback daily alert to set is_alert true")
	}
}

func TestAIAdviceGenerateAdviceFallbackPersonalizedForDemoA(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-a", DurationMinutes: 18},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "沙拉", IntakeG: 120, TotalCal: 120},
			{GridIndex: 2, FoodName: "鸡胸肉", IntakeG: 100, TotalCal: 165},
			{GridIndex: 3, FoodName: "西兰花", IntakeG: 70, TotalCal: 25},
		},
		profile: model.UserProfile{
			UserID:   "user-a",
			HeightCM: 165,
			WeightKG: 45,
			Gender:   "female",
			Age:      18,
		},
		todayTotal: 310,
	}
	svc := NewAIAdviceService(store)

	result, err := svc.GenerateAdvice(context.Background(), "user-a", AdviceTypeMealReview)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}
	if !strings.Contains(result.Advice, "增肌") {
		t.Fatalf("expected demo A fallback to mention 增肌, got %s", result.Advice)
	}
	if result.IsAlert {
		t.Fatalf("expected demo A fallback is_alert false")
	}
}

func TestAIAdviceGenerateAdviceFallbackPersonalizedForDemoB(t *testing.T) {
	store := &fakeAIAdviceStore{
		meal: model.Meal{MealID: "meal-b", DurationMinutes: 25},
		grids: []model.MealGrid{
			{GridIndex: 1, FoodName: "炸鸡", IntakeG: 180, TotalCal: 450},
			{GridIndex: 2, FoodName: "薯条", IntakeG: 140, TotalCal: 350},
			{GridIndex: 3, FoodName: "可乐", IntakeG: 300, TotalCal: 120},
			{GridIndex: 4, FoodName: "蘸酱", IntakeG: 60, TotalCal: 80},
		},
		profile: model.UserProfile{
			UserID:   "user-b",
			HeightCM: 170,
			WeightKG: 90,
			Gender:   "male",
			Age:      45,
		},
		todayTotal: 1000,
	}
	svc := NewAIAdviceService(store)

	result, err := svc.GenerateAdvice(context.Background(), "user-b", AdviceTypeMealReview)
	if err != nil {
		t.Fatalf("generate advice failed: %v", err)
	}
	if !strings.Contains(result.Advice, "高油高热量") {
		t.Fatalf("expected demo B fallback to mention high risk calories, got %s", result.Advice)
	}
	if !result.IsAlert {
		t.Fatalf("expected demo B fallback is_alert true")
	}
}

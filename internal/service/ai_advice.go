package service

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"regexp"
	"strconv"
	"strings"
	"time"

	"kxyz-backend/internal/model"

	"gorm.io/gorm"
)

const (
	AdviceTypeMealReview = "meal_review"
	AdviceTypeDailyAlert = "daily_alert"
	AdviceTypeNextMeal   = "next_meal"
	driInstruction       = "营养评估模型参考《中国居民膳食营养素参考摄入量（DRIs）》"
)

var (
	ErrUnsupportedAdviceType = errors.New("unsupported advice type")
	ErrNoMealData            = errors.New("no meal data")
	ErrAIUnavailable         = errors.New("ai service unavailable")
	ErrAIResponseInvalid     = errors.New("ai response invalid")
)

type AITextGenerator interface {
	Generate(ctx context.Context, prompt string) (string, error)
}

type AIAdviceResult struct {
	Type    string `json:"type"`
	Advice  string `json:"advice"`
	IsAlert bool   `json:"is_alert"`
	Prompt  string `json:"prompt"`
}

type AIAdviceStore interface {
	GetLatestMealWithGrids(ctx context.Context, userID string) (model.Meal, []model.MealGrid, error)
	SumTodayCalories(ctx context.Context, userID string, start time.Time, end time.Time) (float64, error)
	AggregateDailyStatistics(
		ctx context.Context,
		userID string,
		startDate time.Time,
		endDate time.Time,
	) ([]model.DailyStatisticsRow, error)
}

type AIAdviceService struct {
	store     AIAdviceStore
	generator AITextGenerator
	now       func() time.Time
}

func NewAIAdviceService(store AIAdviceStore, generators ...AITextGenerator) *AIAdviceService {
	var generator AITextGenerator
	if len(generators) > 0 {
		generator = generators[0]
	}

	return &AIAdviceService{
		store:     store,
		generator: generator,
		now:       time.Now,
	}
}

func (s *AIAdviceService) GenerateAdvice(
	ctx context.Context,
	userID string,
	adviceType string,
) (AIAdviceResult, error) {
	normalizedAdviceType := normalizeAdviceType(adviceType)
	prompt, err := s.BuildPrompt(ctx, userID, normalizedAdviceType)
	if err != nil {
		return AIAdviceResult{}, err
	}
	if s.generator == nil {
		return AIAdviceResult{}, ErrAIUnavailable
	}

	rawAdvice, err := s.generator.Generate(ctx, prompt)
	if err != nil {
		return AIAdviceResult{}, err
	}

	parsedAdvice, parsedAlert, ok := parseModelJSONResult(rawAdvice)
	adviceText := rawAdvice
	isAlert := false
	if ok {
		adviceText = parsedAdvice
		isAlert = parsedAlert
	} else {
		adviceText = strings.TrimSpace(rawAdvice)
		isAlert = inferIsAlertFromText(normalizedAdviceType, adviceText)
	}
	if adviceText == "" {
		return AIAdviceResult{}, ErrAIResponseInvalid
	}

	return AIAdviceResult{
		Type:    normalizedAdviceType,
		Advice:  adviceText,
		IsAlert: isAlert,
		Prompt:  prompt,
	}, nil
}

func (s *AIAdviceService) BuildPrompt(ctx context.Context, userID string, adviceType string) (string, error) {
	userID = strings.TrimSpace(userID)
	if userID == "" {
		return "", ErrInvalidInput
	}

	adviceType = normalizeAdviceType(adviceType)
	if !isSupportedAdviceType(adviceType) {
		return "", ErrUnsupportedAdviceType
	}

	meal, grids, err := s.store.GetLatestMealWithGrids(ctx, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", ErrNoMealData
		}
		return "", err
	}

	todayStart := truncateUTCDate(s.now().UTC())
	todayEnd := todayStart.AddDate(0, 0, 1)
	todayCalories, err := s.store.SumTodayCalories(ctx, userID, todayStart, todayEnd)
	if err != nil {
		return "", err
	}

	recentStart := todayStart.AddDate(0, 0, -2)
	recentRows, err := s.store.AggregateDailyStatistics(ctx, userID, recentStart, todayStart)
	if err != nil {
		return "", err
	}

	gridSummary := formatGridSummary(meal, grids)
	threeDaySummary := formatThreeDaySummary(recentRows)
	totalMealCalories := sumMealCalories(grids)

	var prompt string
	switch adviceType {
	case AdviceTypeDailyAlert:
		prompt = fmt.Sprintf(
			"%s。任务类型:%s。用户今日总摄入:%.1fkcal。最近一餐总摄入:%.1fkcal，详情:%s。过去三天趋势:%s。请判断是否触发饮食异常警报，并给出一句系统提示语。输出格式要求：仅返回JSON字符串，格式为{\"advice\":\"...\",\"is_alert\":true/false}。",
			driInstruction,
			adviceType,
			todayCalories,
			totalMealCalories,
			gridSummary,
			threeDaySummary,
		)
	case AdviceTypeNextMeal:
		prompt = fmt.Sprintf(
			"%s。任务类型:%s。用户最近一餐详情:%s。用户今日总摄入:%.1fkcal。过去三天趋势:%s。请给出下一餐四格餐盒建议，每格给出菜名与推荐理由。输出格式要求：仅返回JSON字符串，格式为{\"advice\":\"...\",\"is_alert\":true/false}。",
			driInstruction,
			adviceType,
			gridSummary,
			todayCalories,
			threeDaySummary,
		)
	default:
		prompt = fmt.Sprintf(
			"%s。任务类型:%s。用户最近一餐用时:%d分钟，总摄入:%.1fkcal，详情:%s。用户今日累计摄入:%.1fkcal。过去三天趋势:%s。请生成50字以内、带一点幽默感的健康点评。输出格式要求：仅返回JSON字符串，格式为{\"advice\":\"...\",\"is_alert\":true/false}。",
			driInstruction,
			adviceType,
			meal.DurationMinutes,
			totalMealCalories,
			gridSummary,
			todayCalories,
			threeDaySummary,
		)
	}

	log.Printf("[AI_PROMPT] user_id=%s type=%s prompt=%s", userID, adviceType, prompt)
	return prompt, nil
}

func parseModelJSONResult(raw string) (string, bool, bool) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", false, false
	}

	type modelResult struct {
		Advice  string `json:"advice"`
		IsAlert bool   `json:"is_alert"`
	}

	candidates := parseModelCandidates(trimmed)
	for _, candidate := range candidates {
		var parsed modelResult
		if err := parseJSONLoose(candidate, &parsed); err != nil {
			continue
		}
		advice := strings.TrimSpace(parsed.Advice)
		if advice == "" {
			continue
		}
		return advice, parsed.IsAlert, true
	}

	for _, candidate := range candidates {
		advice, isAlert, ok := parseJSONByPattern(candidate)
		if ok {
			return advice, isAlert, true
		}
	}

	return "", false, false
}

func parseJSONLoose(raw string, out any) error {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start >= 0 && end > start {
		raw = raw[start : end+1]
	}
	return jsonUnmarshal([]byte(raw), out)
}

var jsonUnmarshal = func(data []byte, v any) error {
	return json.Unmarshal(data, v)
}

func parseModelCandidates(raw string) []string {
	candidates := make([]string, 0, 6)
	appendUniqueCandidate(&candidates, raw)

	if fenced := extractMarkdownJSON(raw); fenced != "" {
		appendUniqueCandidate(&candidates, fenced)
	}

	current := append([]string(nil), candidates...)
	for _, candidate := range current {
		if unescaped, ok := unescapeJSONLikeText(candidate); ok {
			appendUniqueCandidate(&candidates, unescaped)
			if fenced := extractMarkdownJSON(unescaped); fenced != "" {
				appendUniqueCandidate(&candidates, fenced)
			}
		}
	}

	return candidates
}

func appendUniqueCandidate(candidates *[]string, raw string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return
	}
	for _, existing := range *candidates {
		if existing == raw {
			return
		}
	}
	*candidates = append(*candidates, raw)
}

var markdownJSONFenceRe = regexp.MustCompile("(?is)```(?:json)?\\s*(.*?)\\s*```")

func extractMarkdownJSON(raw string) string {
	matches := markdownJSONFenceRe.FindStringSubmatch(strings.TrimSpace(raw))
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}

func unescapeJSONLikeText(raw string) (string, bool) {
	if !strings.Contains(raw, `\"`) && !strings.Contains(raw, `\\`) {
		return "", false
	}

	unquoted, err := strconv.Unquote(`"` + raw + `"`)
	if err == nil {
		return strings.TrimSpace(unquoted), true
	}

	replaced := strings.ReplaceAll(raw, `\"`, `"`)
	replaced = strings.ReplaceAll(replaced, `\\n`, "\n")
	replaced = strings.ReplaceAll(replaced, `\\t`, "\t")
	return strings.TrimSpace(replaced), replaced != strings.TrimSpace(raw)
}

var (
	adviceAlertPattern = regexp.MustCompile(`(?is)"advice"\s*:\s*"(.*?)"\s*,\s*"is_alert"\s*:\s*(true|false)`)
	alertAdvicePattern = regexp.MustCompile(`(?is)"is_alert"\s*:\s*(true|false)\s*,\s*"advice"\s*:\s*"(.*?)"`)
)

func parseJSONByPattern(raw string) (string, bool, bool) {
	if advice, isAlert, ok := parseJSONByRegex(adviceAlertPattern, raw, 1, 2); ok {
		return advice, isAlert, true
	}
	if advice, isAlert, ok := parseJSONByRegex(alertAdvicePattern, raw, 2, 1); ok {
		return advice, isAlert, true
	}
	return "", false, false
}

func parseJSONByRegex(
	pattern *regexp.Regexp,
	raw string,
	adviceIndex int,
	isAlertIndex int,
) (string, bool, bool) {
	matches := pattern.FindStringSubmatch(raw)
	if len(matches) <= adviceIndex || len(matches) <= isAlertIndex {
		return "", false, false
	}

	advice := strings.TrimSpace(matches[adviceIndex])
	isAlertRaw := strings.ToLower(strings.TrimSpace(matches[isAlertIndex]))
	if advice == "" || (isAlertRaw != "true" && isAlertRaw != "false") {
		return "", false, false
	}

	if decoded, err := strconv.Unquote(`"` + advice + `"`); err == nil {
		advice = strings.TrimSpace(decoded)
	}
	if advice == "" {
		return "", false, false
	}

	return advice, isAlertRaw == "true", true
}

func inferIsAlertFromText(adviceType string, adviceText string) bool {
	if adviceType != AdviceTypeDailyAlert {
		return false
	}

	content := strings.ToLower(strings.TrimSpace(adviceText))
	if content == "" {
		return false
	}

	if strings.Contains(content, "is_alert") {
		for _, token := range []string{"true", "1", "yes"} {
			if strings.Contains(content, token) {
				return true
			}
		}
	}

	for _, keyword := range []string{
		"警报",
		"预警",
		"异常",
		"超标",
		"不足",
		"过量",
		"风险",
		"alert",
	} {
		if strings.Contains(content, keyword) {
			return true
		}
	}

	return false
}

func normalizeAdviceType(raw string) string {
	value := strings.ToLower(strings.TrimSpace(raw))
	if value == "" {
		return AdviceTypeMealReview
	}
	return value
}

func isSupportedAdviceType(adviceType string) bool {
	return adviceType == AdviceTypeMealReview ||
		adviceType == AdviceTypeDailyAlert ||
		adviceType == AdviceTypeNextMeal
}

func formatGridSummary(meal model.Meal, grids []model.MealGrid) string {
	if len(grids) == 0 {
		return "无格子数据"
	}

	parts := make([]string, 0, len(grids))
	for _, grid := range grids {
		foodName := strings.TrimSpace(grid.FoodName)
		if foodName == "" {
			foodName = "未命名食物"
		}
		speed := 0.0
		if meal.DurationMinutes > 0 {
			speed = float64(grid.IntakeG) / float64(meal.DurationMinutes)
		}
		parts = append(parts, fmt.Sprintf(
			"格%d(%s):摄入%dg/%.1fkcal/速度%.1fg每分钟",
			grid.GridIndex,
			foodName,
			grid.IntakeG,
			grid.TotalCal,
			speed,
		))
	}
	return strings.Join(parts, "；")
}

func formatThreeDaySummary(rows []model.DailyStatisticsRow) string {
	if len(rows) == 0 {
		return "最近三天无就餐数据"
	}

	parts := make([]string, 0, len(rows))
	for _, row := range rows {
		date := normalizeSummaryDate(row.Date)
		if date == "" {
			date = strings.TrimSpace(row.Date)
		}
		parts = append(parts, fmt.Sprintf(
			"%s:摄入%.1fkcal/进食%.1fg/速度%.1fg每分钟",
			date,
			row.DailyCalories,
			row.DailyIntakeG,
			row.AvgSpeedGPerMin,
		))
	}
	return strings.Join(parts, "；")
}

func sumMealCalories(grids []model.MealGrid) float64 {
	total := 0.0
	for _, grid := range grids {
		total += grid.TotalCal
	}
	return total
}

func truncateUTCDate(value time.Time) time.Time {
	utc := value.UTC()
	return time.Date(utc.Year(), utc.Month(), utc.Day(), 0, 0, 0, 0, time.UTC)
}

func normalizeSummaryDate(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}

	if len(raw) >= 10 {
		head := raw[:10]
		if _, err := time.Parse("2006-01-02", head); err == nil {
			return head
		}
	}
	if t, err := time.Parse(time.RFC3339Nano, raw); err == nil {
		return t.UTC().Format("2006-01-02")
	}
	if t, err := time.Parse(time.RFC3339, raw); err == nil {
		return t.UTC().Format("2006-01-02")
	}
	return ""
}

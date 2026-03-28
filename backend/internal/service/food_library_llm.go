package service

import (
	"context"
	"crypto/sha1"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"sync"
)

const foodLibrarySystemPrompt = "你是食物热量检索引擎。只返回 JSON，不要额外文本。格式:{\"matches\":[{\"food_name_cn\":\"食物\",\"food_name_en\":\"Food\",\"default_unit_cal_per_100g\":123.4}]}。卡路里是每100g估算值。"

type FoodCalorieGenerator interface {
	GenerateWithSystemPrompt(ctx context.Context, systemPrompt string, prompt string) (string, error)
}

type LLMFoodLibrary struct {
	fallback  FoodLibrary
	generator FoodCalorieGenerator

	mu      sync.RWMutex
	runtime map[string]FoodLibraryItem
}

func NewLLMFoodLibrary(fallback FoodLibrary, generator FoodCalorieGenerator) *LLMFoodLibrary {
	if fallback == nil {
		fallback = NewStaticFoodLibrary()
	}
	return &LLMFoodLibrary{
		fallback:  fallback,
		generator: generator,
		runtime:   make(map[string]FoodLibraryItem),
	}
}

func (s *LLMFoodLibrary) Search(ctx context.Context, keyword string) ([]FoodLibraryItem, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return nil, ErrInvalidInput
	}

	if s.generator == nil {
		return s.fallback.Search(ctx, keyword)
	}

	prompt := fmt.Sprintf(
		"关键词: %s。请返回最多5个最可能食物及每100g热量估算。必须是 JSON。",
		keyword,
	)
	raw, err := s.generator.GenerateWithSystemPrompt(ctx, foodLibrarySystemPrompt, prompt)
	if err != nil {
		return s.fallback.Search(ctx, keyword)
	}

	items, err := parseFoodLibraryLLMResponse(raw, keyword)
	if err != nil || len(items) == 0 {
		return s.fallback.Search(ctx, keyword)
	}

	s.mu.Lock()
	for _, item := range items {
		s.runtime[strings.ToUpper(item.FoodCode)] = item
	}
	s.mu.Unlock()
	return items, nil
}

func (s *LLMFoodLibrary) FindByCode(ctx context.Context, foodCode string) (FoodLibraryItem, error) {
	foodCode = strings.ToUpper(strings.TrimSpace(foodCode))
	if foodCode == "" {
		return FoodLibraryItem{}, ErrInvalidInput
	}

	s.mu.RLock()
	if item, ok := s.runtime[foodCode]; ok {
		s.mu.RUnlock()
		return item, nil
	}
	s.mu.RUnlock()

	return s.fallback.FindByCode(ctx, foodCode)
}

type llmFoodLibraryResponse struct {
	Matches []llmFoodLibraryRawItem `json:"matches"`
}

type llmFoodLibraryRawItem struct {
	FoodCode              string          `json:"food_code"`
	FoodNameCN            string          `json:"food_name_cn"`
	FoodNameEN            string          `json:"food_name_en"`
	DefaultUnitCalPer100G json.RawMessage `json:"default_unit_cal_per_100g"`
}

func parseFoodLibraryLLMResponse(raw string, keyword string) ([]FoodLibraryItem, error) {
	candidates := parseFoodLibraryJSONCandidates(raw)
	for _, candidate := range candidates {
		items, ok := parseFoodLibraryCandidate(candidate, keyword)
		if ok && len(items) > 0 {
			return items, nil
		}
	}
	return nil, ErrAIResponseInvalid
}

func parseFoodLibraryCandidate(raw string, keyword string) ([]FoodLibraryItem, bool) {
	var wrapped llmFoodLibraryResponse
	if err := json.Unmarshal([]byte(raw), &wrapped); err == nil {
		items := normalizeFoodLibraryItems(wrapped.Matches, keyword)
		if len(items) > 0 {
			return items, true
		}
	}

	var arr []llmFoodLibraryRawItem
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		items := normalizeFoodLibraryItems(arr, keyword)
		if len(items) > 0 {
			return items, true
		}
	}

	return nil, false
}

func normalizeFoodLibraryItems(raw []llmFoodLibraryRawItem, keyword string) []FoodLibraryItem {
	items := make([]FoodLibraryItem, 0, len(raw))
	seen := make(map[string]struct{}, len(raw))
	for _, item := range raw {
		foodNameCN := strings.TrimSpace(item.FoodNameCN)
		foodNameEN := strings.TrimSpace(item.FoodNameEN)
		if foodNameCN == "" {
			foodNameCN = strings.TrimSpace(keyword)
		}
		if foodNameCN == "" && foodNameEN == "" {
			continue
		}

		cal, ok := parseCalorie(item.DefaultUnitCalPer100G)
		if !ok || cal <= 0 {
			continue
		}

		foodCode := strings.ToUpper(strings.TrimSpace(item.FoodCode))
		if foodCode == "" {
			foodCode = generatedFoodCode(foodNameCN, foodNameEN)
		}
		if _, ok := seen[foodCode]; ok {
			continue
		}
		seen[foodCode] = struct{}{}

		items = append(items, FoodLibraryItem{
			FoodCode:              foodCode,
			FoodNameCN:            foodNameCN,
			FoodNameEN:            foodNameEN,
			DefaultUnitCalPer100G: cal,
		})
	}
	return items
}

func parseCalorie(raw json.RawMessage) (float64, bool) {
	raw = json.RawMessage(strings.TrimSpace(string(raw)))
	if len(raw) == 0 {
		return 0, false
	}

	var asFloat float64
	if err := json.Unmarshal(raw, &asFloat); err == nil {
		return asFloat, true
	}

	var asText string
	if err := json.Unmarshal(raw, &asText); err != nil {
		return 0, false
	}
	asText = strings.TrimSpace(asText)
	asText = strings.TrimSuffix(asText, "kcal")
	asText = strings.TrimSuffix(asText, "千卡")
	asText = strings.TrimSpace(asText)
	value, err := strconv.ParseFloat(asText, 64)
	if err != nil {
		return 0, false
	}
	return value, true
}

func generatedFoodCode(foodNameCN string, foodNameEN string) string {
	seed := strings.ToLower(strings.TrimSpace(foodNameCN + "|" + foodNameEN))
	if seed == "|" {
		seed = "unknown"
	}
	sum := sha1.Sum([]byte(seed))
	return fmt.Sprintf("AI%x", sum[:4])
}

func parseFoodLibraryJSONCandidates(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	candidates := make([]string, 0, 4)
	appendUniqueFoodLibraryCandidate(&candidates, raw)

	if fenced := extractFoodLibraryMarkdownJSON(raw); fenced != "" {
		appendUniqueFoodLibraryCandidate(&candidates, fenced)
	}

	if unescaped, ok := unescapeFoodLibraryJSON(raw); ok {
		appendUniqueFoodLibraryCandidate(&candidates, unescaped)
		if fenced := extractFoodLibraryMarkdownJSON(unescaped); fenced != "" {
			appendUniqueFoodLibraryCandidate(&candidates, fenced)
		}
	}
	return candidates
}

func appendUniqueFoodLibraryCandidate(candidates *[]string, raw string) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return
	}
	for _, current := range *candidates {
		if current == raw {
			return
		}
	}
	*candidates = append(*candidates, raw)
}

var foodLibraryMarkdownJSONFenceRe = regexp.MustCompile("(?is)```(?:json)?\\s*(.*?)\\s*```")

func extractFoodLibraryMarkdownJSON(raw string) string {
	matches := foodLibraryMarkdownJSONFenceRe.FindStringSubmatch(strings.TrimSpace(raw))
	if len(matches) < 2 {
		return ""
	}
	return strings.TrimSpace(matches[1])
}

func unescapeFoodLibraryJSON(raw string) (string, bool) {
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
	replaced = strings.TrimSpace(replaced)
	return replaced, replaced != strings.TrimSpace(raw)
}

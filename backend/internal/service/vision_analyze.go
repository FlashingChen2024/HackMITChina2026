package service

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	defaultVisionTimeout = 2 * time.Second
	visionSystemPrompt   = "你是 K-XYZ 食物识别引擎。请只返回 JSON，格式为{\"tags\":[\"食物1\",\"食物2\"]}，不要输出任何额外说明。"
	visionUserPrompt     = "请识别图片中的主要食物并返回中文标签数组。"
)

var (
	ErrVisionUnavailable     = errors.New("vision service unavailable")
	ErrVisionResponseInvalid = errors.New("vision response invalid")
)

type VisionAnalyzer interface {
	Analyze(ctx context.Context, imageBase64 string) ([]string, error)
}

type VisionClientConfig struct {
	BaseURL    string
	Model      string
	APIKey     string
	HTTPClient *http.Client
	Timeout    time.Duration
}

type OpenAIVisionClient struct {
	baseURL    string
	model      string
	apiKey     string
	httpClient *http.Client
}

func NewOpenAIVisionClient(cfg VisionClientConfig) (*OpenAIVisionClient, error) {
	baseURL := strings.TrimSpace(cfg.BaseURL)
	model := strings.TrimSpace(cfg.Model)
	apiKey := strings.TrimSpace(cfg.APIKey)
	if baseURL == "" || model == "" || apiKey == "" {
		return nil, ErrVisionUnavailable
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		timeout := cfg.Timeout
		if timeout <= 0 {
			timeout = defaultVisionTimeout
		}
		httpClient = &http.Client{Timeout: timeout}
	}

	return &OpenAIVisionClient{
		baseURL:    baseURL,
		model:      model,
		apiKey:     apiKey,
		httpClient: httpClient,
	}, nil
}

func (c *OpenAIVisionClient) Analyze(ctx context.Context, imageBase64 string) ([]string, error) {
	imageDataURL, err := normalizeImageDataURL(imageBase64)
	if err != nil {
		return nil, ErrInvalidInput
	}

	endpoint, err := resolveChatCompletionsURL(c.baseURL)
	if err != nil {
		return nil, fmt.Errorf("%w: resolve endpoint failed: %v", ErrVisionUnavailable, err)
	}

	payload := visionChatCompletionsRequest{
		Model: c.model,
		Messages: []visionChatMessage{
			{
				Role:    "system",
				Content: visionSystemPrompt,
			},
			{
				Role: "user",
				Content: []visionMessagePart{
					{
						Type: "text",
						Text: visionUserPrompt,
					},
					{
						Type: "image_url",
						ImageURL: &visionImageURL{
							URL: imageDataURL,
						},
					},
				},
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("%w: marshal request failed: %v", ErrVisionUnavailable, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("%w: create request failed: %v", ErrVisionUnavailable, err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: request failed: %v", ErrVisionUnavailable, err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("%w: read response failed: %v", ErrVisionUnavailable, err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf(
			"%w: status=%d body=%s",
			ErrVisionUnavailable,
			resp.StatusCode,
			strings.TrimSpace(string(respBody)),
		)
	}

	var parsed visionChatCompletionsResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return nil, fmt.Errorf("%w: decode response failed: %v", ErrVisionResponseInvalid, err)
	}
	if len(parsed.Choices) == 0 {
		return nil, ErrVisionResponseInvalid
	}

	content, err := decodeVisionResponseContent(parsed.Choices[0].Message.Content)
	if err != nil {
		return nil, err
	}

	tags, err := extractVisionTags(content)
	if err != nil {
		return nil, err
	}
	return tags, nil
}

func decodeVisionResponseContent(content json.RawMessage) (string, error) {
	content = bytes.TrimSpace(content)
	if len(content) == 0 || bytes.Equal(content, []byte("null")) {
		return "", ErrVisionResponseInvalid
	}

	var text string
	if err := json.Unmarshal(content, &text); err == nil {
		text = strings.TrimSpace(text)
		if text == "" {
			return "", ErrVisionResponseInvalid
		}
		return text, nil
	}

	var parts []visionResponsePart
	if err := json.Unmarshal(content, &parts); err == nil {
		textParts := make([]string, 0, len(parts))
		for _, part := range parts {
			if strings.EqualFold(strings.TrimSpace(part.Type), "text") {
				trimmed := strings.TrimSpace(part.Text)
				if trimmed != "" {
					textParts = append(textParts, trimmed)
				}
			}
		}
		if len(textParts) == 0 {
			return "", ErrVisionResponseInvalid
		}
		return strings.Join(textParts, "\n"), nil
	}

	return "", ErrVisionResponseInvalid
}

func extractVisionTags(raw string) ([]string, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, ErrVisionResponseInvalid
	}

	candidates := []string{raw}
	if fenced := extractMarkdownJSON(raw); fenced != "" {
		candidates = append(candidates, fenced)
	}

	for _, candidate := range candidates {
		if tags := parseVisionTagsJSON(candidate); len(tags) > 0 {
			return tags, nil
		}
	}

	if strings.HasPrefix(raw, "{") || strings.HasPrefix(raw, "[") {
		return nil, ErrVisionResponseInvalid
	}

	if tags := splitVisionTags(raw); len(tags) > 0 {
		return tags, nil
	}

	return nil, ErrVisionResponseInvalid
}

func parseVisionTagsJSON(raw string) []string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil
	}

	var arr []string
	if err := json.Unmarshal([]byte(raw), &arr); err == nil {
		return normalizeVisionTags(arr)
	}

	var obj map[string]json.RawMessage
	if err := json.Unmarshal([]byte(raw), &obj); err != nil {
		return nil
	}

	for _, key := range []string{"tags", "content"} {
		value, ok := obj[key]
		if !ok {
			continue
		}
		if tags := parseVisionTagValue(value); len(tags) > 0 {
			return tags
		}
	}

	return nil
}

func parseVisionTagValue(raw json.RawMessage) []string {
	var arr []string
	if err := json.Unmarshal(raw, &arr); err == nil {
		return normalizeVisionTags(arr)
	}

	var text string
	if err := json.Unmarshal(raw, &text); err != nil {
		return nil
	}
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}

	if nested := parseVisionTagsJSON(text); len(nested) > 0 {
		return nested
	}
	return splitVisionTags(text)
}

func splitVisionTags(raw string) []string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return nil
	}
	trimmed = strings.Trim(trimmed, "[]")

	parts := strings.FieldsFunc(trimmed, func(r rune) bool {
		switch r {
		case ',', '，', '、', ';', '；', '\n', '\r', '\t', '|':
			return true
		default:
			return false
		}
	})

	return normalizeVisionTags(parts)
}

func normalizeVisionTags(tags []string) []string {
	result := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		cleaned := strings.TrimSpace(tag)
		cleaned = strings.Trim(cleaned, "\"'`")
		if cleaned == "" {
			continue
		}
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		result = append(result, cleaned)
	}
	return result
}

func normalizeImageDataURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", ErrInvalidInput
	}

	lower := strings.ToLower(trimmed)
	if strings.HasPrefix(lower, "data:image/") {
		parts := strings.SplitN(trimmed, ",", 2)
		if len(parts) != 2 {
			return "", ErrInvalidInput
		}
		header := strings.ToLower(strings.TrimSpace(parts[0]))
		if !strings.Contains(header, ";base64") {
			return "", ErrInvalidInput
		}

		payload := compactBase64(parts[1])
		if !isValidBase64(payload) {
			return "", ErrInvalidInput
		}
		return parts[0] + "," + payload, nil
	}

	payload := compactBase64(trimmed)
	if !isValidBase64(payload) {
		return "", ErrInvalidInput
	}
	return "data:image/webp;base64," + payload, nil
}

func compactBase64(raw string) string {
	replacer := strings.NewReplacer(
		"\n", "",
		"\r", "",
		"\t", "",
		" ", "",
	)
	return replacer.Replace(strings.TrimSpace(raw))
}

func isValidBase64(raw string) bool {
	if raw == "" {
		return false
	}
	if _, err := base64.StdEncoding.DecodeString(raw); err == nil {
		return true
	}
	if _, err := base64.RawStdEncoding.DecodeString(raw); err == nil {
		return true
	}
	return false
}

type visionChatCompletionsRequest struct {
	Model    string              `json:"model"`
	Messages []visionChatMessage `json:"messages"`
}

type visionChatMessage struct {
	Role    string `json:"role"`
	Content any    `json:"content"`
}

type visionMessagePart struct {
	Type     string          `json:"type"`
	Text     string          `json:"text,omitempty"`
	ImageURL *visionImageURL `json:"image_url,omitempty"`
}

type visionImageURL struct {
	URL string `json:"url"`
}

type visionChatCompletionsResponse struct {
	Choices []struct {
		Message struct {
			Content json.RawMessage `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type visionResponsePart struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

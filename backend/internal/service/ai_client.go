package service

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const (
	defaultAITimeout      = 30 * time.Second
	defaultAISystemPrompt = "You are the K-XYZ cloud nutrition advisor. Strictly output only a JSON string in this format: {\"advice\":\"...\",\"is_alert\":true/false}. The advice text must be in English only."
)

type AIModelClientConfig struct {
	BaseURL     string
	Model       string
	APIKey      string
	Temperature float64
	HTTPClient  *http.Client
}

type OpenAICompatibleClient struct {
	baseURL     string
	model       string
	apiKey      string
	temperature float64
	httpClient  *http.Client
}

func NewOpenAICompatibleClient(cfg AIModelClientConfig) (*OpenAICompatibleClient, error) {
	baseURL := strings.TrimSpace(cfg.BaseURL)
	model := strings.TrimSpace(cfg.Model)
	apiKey := strings.TrimSpace(cfg.APIKey)
	if baseURL == "" || model == "" || apiKey == "" {
		return nil, ErrAIUnavailable
	}

	httpClient := cfg.HTTPClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultAITimeout}
	}

	return &OpenAICompatibleClient{
		baseURL:     baseURL,
		model:       model,
		apiKey:      apiKey,
		temperature: cfg.Temperature,
		httpClient:  httpClient,
	}, nil
}

func (c *OpenAICompatibleClient) Generate(ctx context.Context, prompt string) (string, error) {
	return c.GenerateWithSystemPrompt(ctx, defaultAISystemPrompt, prompt)
}

func (c *OpenAICompatibleClient) GenerateWithSystemPrompt(
	ctx context.Context,
	systemPrompt string,
	prompt string,
) (string, error) {
	systemPrompt = strings.TrimSpace(systemPrompt)
	if systemPrompt == "" {
		systemPrompt = defaultAISystemPrompt
	}

	endpoint, err := resolveChatCompletionsURL(c.baseURL)
	if err != nil {
		return "", fmt.Errorf("resolve ai endpoint: %w", err)
	}

	payload := chatCompletionsRequest{
		Model:       c.model,
		Temperature: c.temperature,
		Messages: []chatMessage{
			{
				Role:    "system",
				Content: systemPrompt,
			},
			{
				Role:    "user",
				Content: strings.TrimSpace(prompt),
			},
		},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return "", fmt.Errorf("marshal ai request: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return "", fmt.Errorf("create ai request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.apiKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("request ai api: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("read ai response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("ai api status %d: %s", resp.StatusCode, strings.TrimSpace(string(respBody)))
	}

	var parsed chatCompletionsResponse
	if err := json.Unmarshal(respBody, &parsed); err != nil {
		return "", fmt.Errorf("decode ai response: %w", err)
	}
	if len(parsed.Choices) == 0 {
		return "", ErrAIResponseInvalid
	}

	content := strings.TrimSpace(parsed.Choices[0].Message.Content)
	if content == "" {
		return "", ErrAIResponseInvalid
	}
	return content, nil
}

func resolveChatCompletionsURL(baseURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(baseURL))
	if err != nil {
		return "", err
	}

	path := strings.TrimRight(parsed.Path, "/")
	if strings.HasSuffix(path, "/chat/completions") {
		parsed.Path = path
		return parsed.String(), nil
	}
	if path == "" {
		path = "/v1"
	}
	parsed.Path = path + "/chat/completions"
	return parsed.String(), nil
}

type chatCompletionsRequest struct {
	Model       string        `json:"model"`
	Temperature float64       `json:"temperature"`
	Messages    []chatMessage `json:"messages"`
}

type chatMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type chatCompletionsResponse struct {
	Choices []struct {
		Message chatMessage `json:"message"`
	} `json:"choices"`
}

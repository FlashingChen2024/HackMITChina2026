package service

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestNewOpenAIVisionClientRequiresConfig(t *testing.T) {
	_, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: "https://api.example.com/v1",
		Model:   "gpt-4o-mini",
	})
	if err != ErrVisionUnavailable {
		t.Fatalf("expected ErrVisionUnavailable, got %v", err)
	}
}

func TestOpenAIVisionClientAnalyzeReturnsTagsFromResponse(t *testing.T) {
	var requestPath string
	var authHeader string
	var requestBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		requestPath = r.URL.Path
		authHeader = r.Header.Get("Authorization")
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"tags\":[\"汉堡\",\"薯条\"]}"}}]}`))
	}))
	defer server.Close()

	client, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: server.URL + "/v1",
		Model:   "gpt-4o-mini",
		APIKey:  "vision-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	tags, err := client.Analyze(context.Background(), "aGVsbG8=")
	if err != nil {
		t.Fatalf("analyze failed: %v", err)
	}

	if requestPath != "/v1/chat/completions" {
		t.Fatalf("unexpected request path: %s", requestPath)
	}
	if authHeader != "Bearer vision-key" {
		t.Fatalf("unexpected auth header: %s", authHeader)
	}
	if len(tags) != 2 || tags[0] != "汉堡" || tags[1] != "薯条" {
		t.Fatalf("unexpected tags: %#v", tags)
	}

	model, _ := requestBody["model"].(string)
	if model != "gpt-4o-mini" {
		t.Fatalf("unexpected model: %v", requestBody["model"])
	}

	messages, ok := requestBody["messages"].([]any)
	if !ok || len(messages) != 2 {
		t.Fatalf("unexpected messages payload: %#v", requestBody["messages"])
	}
	userMessage, ok := messages[1].(map[string]any)
	if !ok {
		t.Fatalf("unexpected user message payload: %#v", messages[1])
	}
	parts, ok := userMessage["content"].([]any)
	if !ok || len(parts) != 2 {
		t.Fatalf("unexpected user content payload: %#v", userMessage["content"])
	}
	imagePart, ok := parts[1].(map[string]any)
	if !ok {
		t.Fatalf("unexpected image part: %#v", parts[1])
	}
	imageURLPayload, ok := imagePart["image_url"].(map[string]any)
	if !ok {
		t.Fatalf("unexpected image_url payload: %#v", imagePart["image_url"])
	}
	imageURL, _ := imageURLPayload["url"].(string)
	if !strings.HasPrefix(imageURL, "data:image/webp;base64,aGVsbG8=") {
		t.Fatalf("expected data URL in request, got %s", imageURL)
	}
}

func TestOpenAIVisionClientAnalyzeParsesContentArray(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"content\":[\"米饭\",\"鸡胸肉\"]}"}}]}`))
	}))
	defer server.Close()

	client, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: server.URL + "/v1",
		Model:   "gpt-4o-mini",
		APIKey:  "vision-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	tags, err := client.Analyze(context.Background(), "aGVsbG8=")
	if err != nil {
		t.Fatalf("analyze failed: %v", err)
	}
	if len(tags) != 2 || tags[0] != "米饭" || tags[1] != "鸡胸肉" {
		t.Fatalf("unexpected tags: %#v", tags)
	}
}

func TestOpenAIVisionClientAnalyzeRejectsInvalidBase64(t *testing.T) {
	client, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: "https://api.example.com/v1",
		Model:   "gpt-4o-mini",
		APIKey:  "vision-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	_, err = client.Analyze(context.Background(), "not-base64")
	if err != ErrInvalidInput {
		t.Fatalf("expected ErrInvalidInput, got %v", err)
	}
}

func TestOpenAIVisionClientAnalyzeMapsUpstreamError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		_, _ = w.Write([]byte(`{"error":"unauthorized"}`))
	}))
	defer server.Close()

	client, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: server.URL + "/v1",
		Model:   "gpt-4o-mini",
		APIKey:  "vision-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	_, err = client.Analyze(context.Background(), "aGVsbG8=")
	if !errors.Is(err, ErrVisionUnavailable) {
		t.Fatalf("expected ErrVisionUnavailable, got %v", err)
	}
}

func TestOpenAIVisionClientAnalyzeRejectsInvalidModelPayload(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"foo\":\"bar\"}"}}]}`))
	}))
	defer server.Close()

	client, err := NewOpenAIVisionClient(VisionClientConfig{
		BaseURL: server.URL + "/v1",
		Model:   "gpt-4o-mini",
		APIKey:  "vision-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	_, err = client.Analyze(context.Background(), "aGVsbG8=")
	if !errors.Is(err, ErrVisionResponseInvalid) {
		t.Fatalf("expected ErrVisionResponseInvalid, got %v", err)
	}
}

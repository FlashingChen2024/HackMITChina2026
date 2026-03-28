package service

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNewOpenAICompatibleClientRequiresConfig(t *testing.T) {
	_, err := NewOpenAICompatibleClient(AIModelClientConfig{
		BaseURL: "https://api.example.com/v1",
		Model:   "gpt-test",
	})
	if err != ErrAIUnavailable {
		t.Fatalf("expected ErrAIUnavailable, got %v", err)
	}
}

func TestOpenAICompatibleClientGenerate(t *testing.T) {
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
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"{\"advice\":\"多补蔬菜\",\"is_alert\":false}"}}]}`))
	}))
	defer server.Close()

	client, err := NewOpenAICompatibleClient(AIModelClientConfig{
		BaseURL:     server.URL + "/v1",
		Model:       "gpt-test",
		APIKey:      "test-key",
		Temperature: 0.7,
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	content, err := client.Generate(context.Background(), "prompt-demo")
	if err != nil {
		t.Fatalf("generate failed: %v", err)
	}

	if requestPath != "/v1/chat/completions" {
		t.Fatalf("unexpected request path: %s", requestPath)
	}
	if authHeader != "Bearer test-key" {
		t.Fatalf("unexpected auth header: %s", authHeader)
	}
	if content != "{\"advice\":\"多补蔬菜\",\"is_alert\":false}" {
		t.Fatalf("unexpected content: %s", content)
	}
	if gotModel, ok := requestBody["model"].(string); !ok || gotModel != "gpt-test" {
		t.Fatalf("unexpected request model: %v", requestBody["model"])
	}
	if gotTemperature, ok := requestBody["temperature"].(float64); !ok || gotTemperature != 0.7 {
		t.Fatalf("unexpected request temperature: %v", requestBody["temperature"])
	}
}

func TestOpenAICompatibleClientGenerateWithSystemPrompt(t *testing.T) {
	var requestBody map[string]any

	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if err := json.NewDecoder(r.Body).Decode(&requestBody); err != nil {
			t.Fatalf("decode request: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"choices":[{"message":{"content":"ok"}}]}`))
	}))
	defer server.Close()

	client, err := NewOpenAICompatibleClient(AIModelClientConfig{
		BaseURL: server.URL + "/v1",
		Model:   "gpt-test",
		APIKey:  "test-key",
	})
	if err != nil {
		t.Fatalf("new client failed: %v", err)
	}

	_, err = client.GenerateWithSystemPrompt(context.Background(), "system-demo", "prompt-demo")
	if err != nil {
		t.Fatalf("generate with system prompt failed: %v", err)
	}

	messages, ok := requestBody["messages"].([]any)
	if !ok || len(messages) < 1 {
		t.Fatalf("unexpected messages payload: %#v", requestBody["messages"])
	}

	systemMessage, ok := messages[0].(map[string]any)
	if !ok {
		t.Fatalf("unexpected system message payload: %#v", messages[0])
	}

	if systemMessage["content"] != "system-demo" {
		t.Fatalf("expected custom system prompt, got %v", systemMessage["content"])
	}
}

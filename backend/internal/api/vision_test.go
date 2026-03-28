package api_test

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type fakeVisionAnalyzer struct {
	tags      []string
	err       error
	lastImage string
}

func (f *fakeVisionAnalyzer) Analyze(_ context.Context, imageBase64 string) ([]string, error) {
	f.lastImage = imageBase64
	if f.err != nil {
		return nil, f.err
	}
	return f.tags, nil
}

func TestVisionAnalyzeSuccess(t *testing.T) {
	gin.SetMode(gin.TestMode)

	analyzer := &fakeVisionAnalyzer{
		tags: []string{"汉堡", "Fried Chicken"},
	}
	handler := api.NewVisionAnalyzeHandler(analyzer)

	router := gin.New()
	router.POST("/api/v1/vision/analyze", handler.Analyze)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/vision/analyze", bytes.NewBufferString(`{"image_base64":"aGVsbG8="}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if analyzer.lastImage != "aGVsbG8=" {
		t.Fatalf("expected forwarded image base64, got %s", analyzer.lastImage)
	}

	var payload struct {
		KeywordsEN []string `json:"keywords_en"`
		KeywordsCN []string `json:"keywords_cn"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(payload.KeywordsCN) != 1 || payload.KeywordsCN[0] != "汉堡" {
		t.Fatalf("unexpected keywords_cn: %#v", payload.KeywordsCN)
	}
	if len(payload.KeywordsEN) != 1 || payload.KeywordsEN[0] != "Fried Chicken" {
		t.Fatalf("unexpected keywords_en: %#v", payload.KeywordsEN)
	}
}

func TestVisionAnalyzeRequiresBody(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewVisionAnalyzeHandler(&fakeVisionAnalyzer{})
	router := gin.New()
	router.POST("/api/v1/vision/analyze", handler.Analyze)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/vision/analyze", bytes.NewBufferString(`{}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusBadRequest {
		t.Fatalf("expected status 400, got %d", resp.Code)
	}
}

func TestVisionAnalyzeReturnsUnavailableWhenAnalyzerMissing(t *testing.T) {
	gin.SetMode(gin.TestMode)

	handler := api.NewVisionAnalyzeHandler(nil)
	router := gin.New()
	router.POST("/api/v1/vision/analyze", handler.Analyze)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/vision/analyze", bytes.NewBufferString(`{"image_base64":"aGVsbG8="}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}

	var payload struct {
		KeywordsEN []string `json:"keywords_en"`
		KeywordsCN []string `json:"keywords_cn"`
	}
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if len(payload.KeywordsCN) != 1 || payload.KeywordsCN[0] != "未知食物" {
		t.Fatalf("unexpected fallback keywords_cn: %#v", payload.KeywordsCN)
	}
	if len(payload.KeywordsEN) != 1 || payload.KeywordsEN[0] != "Unknown Food" {
		t.Fatalf("unexpected fallback keywords_en: %#v", payload.KeywordsEN)
	}
}

func TestVisionAnalyzeFallbackOnServiceErrors(t *testing.T) {
	gin.SetMode(gin.TestMode)

	cases := []struct {
		name       string
		err        error
		wantStatus int
	}{
		{name: "invalid input", err: service.ErrInvalidInput, wantStatus: http.StatusBadRequest},
		{name: "invalid response", err: service.ErrVisionResponseInvalid, wantStatus: http.StatusOK},
		{name: "upstream unavailable", err: service.ErrVisionUnavailable, wantStatus: http.StatusOK},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			handler := api.NewVisionAnalyzeHandler(&fakeVisionAnalyzer{err: tc.err})
			router := gin.New()
			router.POST("/api/v1/vision/analyze", handler.Analyze)

			req := httptest.NewRequest(http.MethodPost, "/api/v1/vision/analyze", bytes.NewBufferString(`{"image_base64":"aGVsbG8="}`))
			req.Header.Set("Content-Type", "application/json")
			resp := httptest.NewRecorder()
			router.ServeHTTP(resp, req)

			if resp.Code != tc.wantStatus {
				t.Fatalf("expected status %d, got %d", tc.wantStatus, resp.Code)
			}
			if tc.wantStatus == http.StatusOK {
				var payload struct {
					KeywordsEN []string `json:"keywords_en"`
					KeywordsCN []string `json:"keywords_cn"`
				}
				if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
					t.Fatalf("unmarshal response: %v", err)
				}
				if len(payload.KeywordsCN) == 0 || len(payload.KeywordsEN) == 0 {
					t.Fatalf("expected fallback payload, got: %s", resp.Body.String())
				}
			}
		})
	}
}

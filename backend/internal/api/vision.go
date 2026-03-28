package api

import (
	"errors"
	"net/http"
	"strings"
	"unicode"

	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type VisionAnalyzeHandler struct {
	analyzer service.VisionAnalyzer
}

type visionAnalyzeRequest struct {
	ImageBase64    string `json:"image_base64" binding:"required"`
	CompressSizeKB int    `json:"compress_size_kb"`
}

type visionAnalyzeResponse struct {
	KeywordsEN []string `json:"keywords_en"`
	KeywordsCN []string `json:"keywords_cn"`
}

var visionFallbackResponse = visionAnalyzeResponse{
	KeywordsEN: []string{"Unknown Food"},
	KeywordsCN: []string{"未知食物"},
}

func NewVisionAnalyzeHandler(analyzer service.VisionAnalyzer) *VisionAnalyzeHandler {
	return &VisionAnalyzeHandler{analyzer: analyzer}
}

func (h *VisionAnalyzeHandler) Analyze(c *gin.Context) {
	var req visionAnalyzeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	if h.analyzer == nil {
		c.JSON(http.StatusOK, visionFallbackResponse)
		return
	}

	tags, err := h.analyzer.Analyze(c.Request.Context(), req.ImageBase64)
	if err != nil {
		switch {
		case errors.Is(err, service.ErrInvalidInput):
			c.JSON(http.StatusBadRequest, gin.H{"error": "image_base64 must be valid base64"})
		default:
			c.JSON(http.StatusOK, visionFallbackResponse)
		}
		return
	}

	c.JSON(http.StatusOK, toVisionAnalyzeResponse(tags))
}

func toVisionAnalyzeResponse(tags []string) visionAnalyzeResponse {
	normalizedTags := normalizeKeywords(tags)
	if len(normalizedTags) == 0 {
		return visionFallbackResponse
	}

	keywordsCN := make([]string, 0, len(normalizedTags))
	keywordsEN := make([]string, 0, len(normalizedTags))
	seenCN := make(map[string]struct{}, len(normalizedTags))
	seenEN := make(map[string]struct{}, len(normalizedTags))

	for _, tag := range normalizedTags {
		hasCN := containsHan(tag)
		hasEN := containsLatin(tag)

		switch {
		case hasCN:
			if _, ok := seenCN[tag]; !ok {
				seenCN[tag] = struct{}{}
				keywordsCN = append(keywordsCN, tag)
			}
		case hasEN:
			if _, ok := seenEN[tag]; !ok {
				seenEN[tag] = struct{}{}
				keywordsEN = append(keywordsEN, tag)
			}
		default:
			if _, ok := seenCN[tag]; !ok {
				seenCN[tag] = struct{}{}
				keywordsCN = append(keywordsCN, tag)
			}
		}
	}

	if len(keywordsCN) == 0 {
		keywordsCN = append(keywordsCN, normalizedTags...)
	}
	if len(keywordsEN) == 0 {
		keywordsEN = append(keywordsEN, keywordsCN...)
	}

	return visionAnalyzeResponse{
		KeywordsEN: keywordsEN,
		KeywordsCN: keywordsCN,
	}
}

func normalizeKeywords(tags []string) []string {
	items := make([]string, 0, len(tags))
	seen := make(map[string]struct{}, len(tags))
	for _, tag := range tags {
		cleaned := strings.TrimSpace(tag)
		if cleaned == "" {
			continue
		}
		if _, ok := seen[cleaned]; ok {
			continue
		}
		seen[cleaned] = struct{}{}
		items = append(items, cleaned)
	}
	return items
}

func containsHan(text string) bool {
	for _, r := range text {
		if unicode.Is(unicode.Han, r) {
			return true
		}
	}
	return false
}

func containsLatin(text string) bool {
	for _, r := range text {
		if unicode.IsLetter(r) && r <= unicode.MaxLatin1 {
			return true
		}
	}
	return false
}

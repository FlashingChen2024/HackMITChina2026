package middleware_test

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/middleware"

	"github.com/gin-gonic/gin"
)

type fakeTokenParser struct {
	userID   string
	username string
	err      error
	token    string
}

func (p *fakeTokenParser) ParseToken(rawToken string) (string, string, error) {
	p.token = rawToken
	if p.err != nil {
		return "", "", p.err
	}
	return p.userID, p.username, nil
}

func TestJWTAuthMiddlewareRejectsMissingAuthorization(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/test", middleware.JWTAuthMiddleware(&fakeTokenParser{}), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

func TestJWTAuthMiddlewareRejectsInvalidAuthorizationHeader(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/test", middleware.JWTAuthMiddleware(&fakeTokenParser{}), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Token abc")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

func TestJWTAuthMiddlewareRejectsInvalidToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	router := gin.New()
	router.GET("/test", middleware.JWTAuthMiddleware(&fakeTokenParser{err: errors.New("bad token")}), func(c *gin.Context) {
		c.Status(http.StatusOK)
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer invalid-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401, got %d", resp.Code)
	}
}

func TestJWTAuthMiddlewareSetsUserContext(t *testing.T) {
	gin.SetMode(gin.TestMode)

	parser := &fakeTokenParser{userID: "user-1", username: "testuser"}
	router := gin.New()
	router.GET("/test", middleware.JWTAuthMiddleware(parser), func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"user_id":  c.GetString("user_id"),
			"username": c.GetString("username"),
		})
	})

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	req.Header.Set("Authorization", "Bearer good-token")
	resp := httptest.NewRecorder()
	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if parser.token != "good-token" {
		t.Fatalf("expected parser to receive token good-token, got %s", parser.token)
	}

	var payload map[string]any
	if err := json.Unmarshal(resp.Body.Bytes(), &payload); err != nil {
		t.Fatalf("unmarshal response: %v", err)
	}
	if payload["user_id"] != "user-1" {
		t.Fatalf("expected user_id user-1, got %v", payload["user_id"])
	}
	if payload["username"] != "testuser" {
		t.Fatalf("expected username testuser, got %v", payload["username"])
	}
}

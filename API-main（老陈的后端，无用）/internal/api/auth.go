package api

import (
	"context"
	"net/http"

	"kxyz-backend/internal/model"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type AuthService interface {
	Register(ctx context.Context, username string, password string) (model.User, error)
	Login(ctx context.Context, username string, password string) (string, model.User, error)
}

type AuthHandler struct {
	service AuthService
}

type authRequest struct {
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required"`
}

type TestAuthHandler struct{}

func NewAuthHandler(service AuthService) *AuthHandler {
	return &AuthHandler{service: service}
}

func NewTestAuthHandler() *TestAuthHandler {
	return &TestAuthHandler{}
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	user, err := h.service.Register(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		switch err {
		case service.ErrUserExists:
			c.JSON(http.StatusConflict, gin.H{"error": "username already exists"})
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "register failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user_id": user.ID,
		"message": "register success",
	})
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req authRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}

	token, user, err := h.service.Login(c.Request.Context(), req.Username, req.Password)
	if err != nil {
		switch err {
		case service.ErrInvalidInput:
			c.JSON(http.StatusBadRequest, gin.H{"error": "username and password are required"})
		case service.ErrInvalidCredentials:
			c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid username or password"})
		default:
			c.JSON(http.StatusInternalServerError, gin.H{"error": "login failed"})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"token":    token,
		"user_id":  user.ID,
		"username": user.Username,
	})
}

func (h *TestAuthHandler) Handle(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"message":  "authorized",
		"user_id":  c.GetString("user_id"),
		"username": c.GetString("username"),
	})
}

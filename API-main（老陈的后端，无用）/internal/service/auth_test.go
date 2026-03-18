package service

import (
	"context"
	"testing"
	"time"

	"kxyz-backend/internal/model"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type fakeUserStore struct {
	users     map[string]model.User
	createErr error
	getErr    error
	created   []model.User
}

func newFakeUserStore() *fakeUserStore {
	return &fakeUserStore{
		users: make(map[string]model.User),
	}
}

func (s *fakeUserStore) CreateUser(_ context.Context, user model.User) error {
	if s.createErr != nil {
		return s.createErr
	}
	s.users[user.Username] = user
	s.created = append(s.created, user)
	return nil
}

func (s *fakeUserStore) GetUserByUsername(_ context.Context, username string) (model.User, error) {
	if s.getErr != nil {
		return model.User{}, s.getErr
	}
	user, ok := s.users[username]
	if !ok {
		return model.User{}, gorm.ErrRecordNotFound
	}
	return user, nil
}

func TestAuthServiceRegisterHashesPassword(t *testing.T) {
	store := newFakeUserStore()
	svc := NewAuthService(store, "test-secret", time.Hour)

	user, err := svc.Register(context.Background(), "testuser", "testpass")
	if err != nil {
		t.Fatalf("register failed: %v", err)
	}

	if user.ID == "" {
		t.Fatalf("expected generated user id")
	}
	if user.Username != "testuser" {
		t.Fatalf("expected username testuser, got %s", user.Username)
	}
	if user.PasswordHash == "testpass" || user.PasswordHash == "" {
		t.Fatalf("expected hashed password to be stored")
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte("testpass")); err != nil {
		t.Fatalf("password hash does not match original password: %v", err)
	}
}

func TestAuthServiceLoginIssuesJWT(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("testpass"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	store := newFakeUserStore()
	store.users["testuser"] = model.User{
		ID:           "user-1",
		Username:     "testuser",
		PasswordHash: string(hash),
		CreatedAt:    time.Now().UTC(),
	}

	svc := NewAuthService(store, "test-secret", time.Hour)
	token, user, err := svc.Login(context.Background(), "testuser", "testpass")
	if err != nil {
		t.Fatalf("login failed: %v", err)
	}

	if token == "" {
		t.Fatalf("expected non-empty token")
	}
	if user.ID != "user-1" {
		t.Fatalf("expected user id user-1, got %s", user.ID)
	}

	userID, username, err := svc.ParseToken(token)
	if err != nil {
		t.Fatalf("parse token failed: %v", err)
	}
	if userID != "user-1" {
		t.Fatalf("expected parsed user id user-1, got %s", userID)
	}
	if username != "testuser" {
		t.Fatalf("expected parsed username testuser, got %s", username)
	}
}

func TestAuthServiceLoginRejectsWrongPassword(t *testing.T) {
	hash, err := bcrypt.GenerateFromPassword([]byte("testpass"), bcrypt.DefaultCost)
	if err != nil {
		t.Fatalf("hash password: %v", err)
	}

	store := newFakeUserStore()
	store.users["testuser"] = model.User{
		ID:           "user-1",
		Username:     "testuser",
		PasswordHash: string(hash),
	}

	svc := NewAuthService(store, "test-secret", time.Hour)
	if _, _, err := svc.Login(context.Background(), "testuser", "badpass"); err != ErrInvalidCredentials {
		t.Fatalf("expected ErrInvalidCredentials, got %v", err)
	}
}

func TestAuthServiceParseTokenRejectsInvalidToken(t *testing.T) {
	store := newFakeUserStore()
	svc := NewAuthService(store, "test-secret", time.Hour)

	if _, _, err := svc.ParseToken("invalid-token"); err != ErrInvalidToken {
		t.Fatalf("expected ErrInvalidToken, got %v", err)
	}
}

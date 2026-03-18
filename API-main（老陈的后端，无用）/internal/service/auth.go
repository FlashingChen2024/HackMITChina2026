package service

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"strings"
	"time"

	"kxyz-backend/internal/model"

	mysqlDriver "github.com/go-sql-driver/mysql"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserExists         = errors.New("user already exists")
	ErrInvalidCredentials = errors.New("invalid credentials")
	ErrInvalidToken       = errors.New("invalid token")
	ErrInvalidInput       = errors.New("invalid input")
)

type UserStore interface {
	CreateUser(ctx context.Context, user model.User) error
	GetUserByUsername(ctx context.Context, username string) (model.User, error)
}

type AuthService struct {
	store     UserStore
	jwtSecret []byte
	tokenTTL  time.Duration
	now       func() time.Time
}

type authClaims struct {
	Username string `json:"username"`
	jwt.RegisteredClaims
}

func NewAuthService(store UserStore, jwtSecret string, tokenTTL time.Duration) *AuthService {
	if tokenTTL <= 0 {
		tokenTTL = 24 * time.Hour
	}

	return &AuthService{
		store:     store,
		jwtSecret: []byte(jwtSecret),
		tokenTTL:  tokenTTL,
		now:       time.Now,
	}
}

func (s *AuthService) Register(ctx context.Context, username string, password string) (model.User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return model.User{}, ErrInvalidInput
	}

	_, err := s.store.GetUserByUsername(ctx, username)
	if err == nil {
		return model.User{}, ErrUserExists
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return model.User{}, err
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return model.User{}, fmt.Errorf("hash password: %w", err)
	}

	id, err := newUUID()
	if err != nil {
		return model.User{}, fmt.Errorf("generate user id: %w", err)
	}

	user := model.User{
		ID:           id,
		Username:     username,
		PasswordHash: string(passwordHash),
		CreatedAt:    s.now().UTC(),
	}
	if err := s.store.CreateUser(ctx, user); err != nil {
		if isDuplicateEntryError(err) {
			return model.User{}, ErrUserExists
		}
		return model.User{}, err
	}

	return user, nil
}

func (s *AuthService) Login(ctx context.Context, username string, password string) (string, model.User, error) {
	username = strings.TrimSpace(username)
	if username == "" || password == "" {
		return "", model.User{}, ErrInvalidInput
	}

	user, err := s.store.GetUserByUsername(ctx, username)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return "", model.User{}, ErrInvalidCredentials
		}
		return "", model.User{}, err
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(password)); err != nil {
		return "", model.User{}, ErrInvalidCredentials
	}

	token, err := s.issueToken(user)
	if err != nil {
		return "", model.User{}, err
	}

	return token, user, nil
}

func (s *AuthService) ParseToken(rawToken string) (string, string, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return "", "", ErrInvalidToken
	}

	claims := &authClaims{}
	token, err := jwt.ParseWithClaims(rawToken, claims, func(token *jwt.Token) (interface{}, error) {
		if token.Method.Alg() != jwt.SigningMethodHS256.Alg() {
			return nil, ErrInvalidToken
		}
		return s.jwtSecret, nil
	})
	if err != nil {
		return "", "", ErrInvalidToken
	}
	if !token.Valid || claims.Subject == "" {
		return "", "", ErrInvalidToken
	}

	return claims.Subject, claims.Username, nil
}

func (s *AuthService) issueToken(user model.User) (string, error) {
	now := s.now().UTC()
	claims := authClaims{
		Username: user.Username,
		RegisteredClaims: jwt.RegisteredClaims{
			Subject:   user.ID,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(s.tokenTTL)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString(s.jwtSecret)
	if err != nil {
		return "", fmt.Errorf("sign token: %w", err)
	}
	return signed, nil
}

func isDuplicateEntryError(err error) bool {
	var mysqlErr *mysqlDriver.MySQLError
	return errors.As(err, &mysqlErr) && mysqlErr.Number == 1062
}

func newUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}

	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80

	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16]), nil
}

package api_test

import (
	"bytes"
	"context"
	"log"
	"net/http"
	"net/http/httptest"
	"testing"

	"kxyz-backend/internal/api"
	"kxyz-backend/internal/service"

	"github.com/gin-gonic/gin"
)

type memoryStateStore struct {
	data map[string]service.DeviceSession
}

func newMemoryStateStore() *memoryStateStore {
	return &memoryStateStore{data: make(map[string]service.DeviceSession)}
}

func (s *memoryStateStore) Load(_ context.Context, deviceID string) (service.DeviceSession, error) {
	session, ok := s.data[deviceID]
	if !ok {
		return service.DeviceSession{CurrentState: service.StateIdle}, nil
	}
	return session, nil
}

func (s *memoryStateStore) Save(_ context.Context, deviceID string, session service.DeviceSession) error {
	s.data[deviceID] = session
	return nil
}

func TestTelemetryAcceptsZeroWeight(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := newMemoryStateStore()
	svc := service.NewTelemetryService(store, log.Default())
	handler := api.NewTelemetryHandler(svc)

	router := gin.New()
	router.POST("/api/v1/hardware/telemetry", handler.Handle)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hardware/telemetry",
		bytes.NewBufferString(`{"device_id":"dev-1","weight_g":0}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
}

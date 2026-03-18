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

type fakeBindingResolver struct {
	userID string
	err    error
}

func (r *fakeBindingResolver) ResolveUserID(_ context.Context, _ string) (string, error) {
	if r.err != nil {
		return "", r.err
	}
	return r.userID, nil
}

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

func TestTelemetryAcceptsZeroWeightIn4Grids(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := newMemoryStateStore()
	svc := service.NewTelemetryService(store, log.Default())
	handler := api.NewTelemetryHandler(svc, &fakeBindingResolver{userID: "user-1"})

	router := gin.New()
	router.POST("/api/v1/hardware/telemetry", handler.Handle)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hardware/telemetry",
		bytes.NewBufferString(`{"device_id":"dev-1","weights":{"grid_1":0,"grid_2":0,"grid_3":0,"grid_4":0}}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
}

func TestTelemetryDropsUnboundDeviceSilently(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := newMemoryStateStore()
	svc := service.NewTelemetryService(store, log.Default())
	handler := api.NewTelemetryHandler(svc, &fakeBindingResolver{err: service.ErrDeviceNotBound})

	router := gin.New()
	router.POST("/api/v1/hardware/telemetry", handler.Handle)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hardware/telemetry",
		bytes.NewBufferString(`{"device_id":"dev-unbound","weights":{"grid_1":10,"grid_2":0,"grid_3":0,"grid_4":0}}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	if _, ok := store.data["dev-unbound"]; ok {
		t.Fatalf("expected unbound device telemetry to be ignored")
	}
}

func TestTelemetryBoundDeviceTriggersStateMachine(t *testing.T) {
	gin.SetMode(gin.TestMode)

	store := newMemoryStateStore()
	svc := service.NewTelemetryService(store, log.Default())
	handler := api.NewTelemetryHandler(svc, &fakeBindingResolver{userID: "user-1"})

	router := gin.New()
	router.POST("/api/v1/hardware/telemetry", handler.Handle)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/hardware/telemetry",
		bytes.NewBufferString(`{"device_id":"dev-bound","weights":{"grid_1":80,"grid_2":20,"grid_3":10,"grid_4":0}}`))
	req.Header.Set("Content-Type", "application/json")
	resp := httptest.NewRecorder()

	router.ServeHTTP(resp, req)

	if resp.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.Code)
	}
	session, ok := store.data["dev-bound"]
	if !ok {
		t.Fatalf("expected redis-like session state to be saved")
	}
	if session.CurrentState != service.StateServing {
		t.Fatalf("expected state SERVING, got %s", session.CurrentState)
	}
}

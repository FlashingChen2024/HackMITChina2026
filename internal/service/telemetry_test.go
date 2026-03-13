package service

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"
)

type memoryDeviceStateStore struct {
	data map[string]DeviceSession
}

func newMemoryDeviceStateStore() *memoryDeviceStateStore {
	return &memoryDeviceStateStore{data: make(map[string]DeviceSession)}
}

func (s *memoryDeviceStateStore) Load(_ context.Context, deviceID string) (DeviceSession, error) {
	session, ok := s.data[deviceID]
	if !ok {
		return DeviceSession{CurrentState: StateIdle}, nil
	}
	return session, nil
}

func (s *memoryDeviceStateStore) Save(_ context.Context, deviceID string, session DeviceSession) error {
	s.data[deviceID] = session
	return nil
}

type createdMealRecord struct {
	MealID       string
	StartTime    time.Time
	TotalServedG int
}

type curveRecord struct {
	MealID    string
	Timestamp time.Time
	WeightG   int
}

type updatedMealRecord struct {
	MealID          string
	DurationMinutes int
	TotalLeftoverG  int
}

type memoryMealPersistence struct {
	created []createdMealRecord
	curves  []curveRecord
	updated []updatedMealRecord
}

func (m *memoryMealPersistence) CreateMeal(_ context.Context, mealID string, startTime time.Time, totalServedG int) error {
	m.created = append(m.created, createdMealRecord{
		MealID:       mealID,
		StartTime:    startTime.UTC(),
		TotalServedG: totalServedG,
	})
	return nil
}

func (m *memoryMealPersistence) InsertMealCurveData(_ context.Context, mealID string, timestamp time.Time, weightG int) error {
	m.curves = append(m.curves, curveRecord{
		MealID:    mealID,
		Timestamp: timestamp.UTC(),
		WeightG:   weightG,
	})
	return nil
}

func (m *memoryMealPersistence) UpdateMealSummary(_ context.Context, mealID string, durationMinutes int, totalLeftoverG int) error {
	m.updated = append(m.updated, updatedMealRecord{
		MealID:          mealID,
		DurationMinutes: durationMinutes,
		TotalLeftoverG:  totalLeftoverG,
	})
	return nil
}

func TestTelemetryFSMTransitions(t *testing.T) {
	store := newMemoryDeviceStateStore()
	var logBuffer bytes.Buffer
	logger := log.New(&logBuffer, "", 0)
	svc := NewTelemetryService(store, logger)
	ctx := context.Background()

	base := time.Date(2026, 3, 12, 12, 0, 0, 0, time.UTC)

	if _, err := svc.Process(ctx, TelemetryInput{
		DeviceID:  "dev-1",
		WeightG:   2,
		Timestamp: base,
	}); err != nil {
		t.Fatalf("process deadband telemetry: %v", err)
	}

	if _, err := svc.Process(ctx, TelemetryInput{
		DeviceID:  "dev-1",
		WeightG:   400,
		Timestamp: base.Add(1 * time.Second),
	}); err != nil {
		t.Fatalf("process serving telemetry: %v", err)
	}

	if _, err := svc.Process(ctx, TelemetryInput{
		DeviceID:  "dev-1",
		WeightG:   390,
		Timestamp: base.Add(16 * time.Second),
	}); err != nil {
		t.Fatalf("process eating telemetry: %v", err)
	}

	if _, err := svc.Process(ctx, TelemetryInput{
		DeviceID:  "dev-1",
		WeightG:   0,
		Timestamp: base.Add(20 * time.Second),
	}); err != nil {
		t.Fatalf("process back-to-idle telemetry: %v", err)
	}

	logs := logBuffer.String()
	expectedKeywords := []string{
		"[死区拦截] 不执行动作",
		"[状态跃迁] IDLE -> SERVING",
		"[状态跃迁] SERVING -> EATING",
		"[状态跃迁] EATING -> IDLE",
	}
	for _, keyword := range expectedKeywords {
		if !strings.Contains(logs, keyword) {
			t.Fatalf("expected log to contain %q, got %s", keyword, logs)
		}
	}
}

func TestTelemetryPersistsMealAndCurveData(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 12, 12, 0, 0, 0, time.UTC)

	inputs := []TelemetryInput{
		{DeviceID: "dev-1", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-1", WeightG: 450, Timestamp: base.Add(16 * time.Second)},
		{DeviceID: "dev-1", WeightG: 400, Timestamp: base.Add(20 * time.Second)},
		{DeviceID: "dev-1", WeightG: 0, Timestamp: base.Add(25 * time.Second)},
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.created) != 1 {
		t.Fatalf("expected 1 meal insert, got %d", len(persistence.created))
	}
	if persistence.created[0].TotalServedG != 500 {
		t.Fatalf("expected total_served_g=500, got %d", persistence.created[0].TotalServedG)
	}

	if len(persistence.curves) != 2 {
		t.Fatalf("expected 2 curve inserts, got %d", len(persistence.curves))
	}
	if persistence.curves[0].WeightG != 450 || persistence.curves[1].WeightG != 400 {
		t.Fatalf("expected curve weights [450,400], got [%d,%d]", persistence.curves[0].WeightG, persistence.curves[1].WeightG)
	}

	if len(persistence.updated) != 1 {
		t.Fatalf("expected 1 meal update, got %d", len(persistence.updated))
	}
	if persistence.updated[0].TotalLeftoverG != 400 {
		t.Fatalf("expected total_leftover_g=400, got %d", persistence.updated[0].TotalLeftoverG)
	}
}

func TestNewMealIDHasFixedLength(t *testing.T) {
	mealID := newMealID("very-long-device-id-that-would-overflow", time.Date(2026, 3, 13, 0, 0, 0, 0, time.UTC))
	if len(mealID) != 36 {
		t.Fatalf("expected meal_id length 36, got %d (%s)", len(mealID), mealID)
	}
}

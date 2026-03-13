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

type servedMealRecord struct {
	MealID          string
	ServedIncrement int
}

type memoryMealPersistence struct {
	created   []createdMealRecord
	servedAdd []servedMealRecord
	curves    []curveRecord
	updated   []updatedMealRecord
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

func (m *memoryMealPersistence) AddMealServedG(_ context.Context, mealID string, servedIncrement int) error {
	m.servedAdd = append(m.servedAdd, servedMealRecord{
		MealID:          mealID,
		ServedIncrement: servedIncrement,
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

func TestTelemetrySupportsEatingRefillAndAccumulatesServed(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 13, 12, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-1", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-1", WeightG: 450, Timestamp: base.Add(16 * time.Second)}, // SERVING -> EATING
		{DeviceID: "dev-1", WeightG: 300, Timestamp: base.Add(20 * time.Second)}, // EATING
		{DeviceID: "dev-1", WeightG: 800, Timestamp: base.Add(24 * time.Second)}, // EATING -> SERVING (refill)
		{DeviceID: "dev-1", WeightG: 780, Timestamp: base.Add(40 * time.Second)}, // SERVING -> EATING, add served
		{DeviceID: "dev-1", WeightG: 700, Timestamp: base.Add(44 * time.Second)}, // EATING
		{DeviceID: "dev-1", WeightG: 0, Timestamp: base.Add(50 * time.Second)},   // EATING -> IDLE
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.created) != 1 {
		t.Fatalf("expected 1 meal creation, got %d", len(persistence.created))
	}
	if persistence.created[0].TotalServedG != 500 {
		t.Fatalf("expected initial served=500, got %d", persistence.created[0].TotalServedG)
	}
	if len(persistence.servedAdd) != 1 {
		t.Fatalf("expected 1 served increment update, got %d", len(persistence.servedAdd))
	}
	if persistence.servedAdd[0].ServedIncrement != 500 {
		t.Fatalf("expected served increment=500, got %d", persistence.servedAdd[0].ServedIncrement)
	}
	if len(persistence.updated) != 1 {
		t.Fatalf("expected 1 summary update, got %d", len(persistence.updated))
	}
	if persistence.updated[0].TotalLeftoverG != 700 {
		t.Fatalf("expected leftover=700, got %d", persistence.updated[0].TotalLeftoverG)
	}
}

func TestTelemetryEndsEatingAfterStable600Seconds(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 13, 13, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-stable", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-stable", WeightG: 490, Timestamp: base.Add(16 * time.Second)},                // SERVING -> EATING
		{DeviceID: "dev-stable", WeightG: 490, Timestamp: base.Add(10*time.Minute + 20*time.Second)}, // stable >=600s
	}

	var lastResult TelemetryResult
	for _, input := range inputs {
		result, err := svc.Process(ctx, input)
		if err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
		lastResult = result
	}

	if lastResult.CurrentState != StateIdle {
		t.Fatalf("expected state IDLE after stable 600s, got %s", lastResult.CurrentState)
	}
	if len(persistence.updated) != 1 {
		t.Fatalf("expected 1 meal summary update, got %d", len(persistence.updated))
	}
	if persistence.updated[0].TotalLeftoverG != 490 {
		t.Fatalf("expected leftover=490, got %d", persistence.updated[0].TotalLeftoverG)
	}
}

func TestTelemetryEnforcesMonotonicCurveInEatingState(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 13, 14, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-mono", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-mono", WeightG: 490, Timestamp: base.Add(16 * time.Second)}, // SERVING -> EATING, insert 490
		{DeviceID: "dev-mono", WeightG: 495, Timestamp: base.Add(24 * time.Second)}, // should be clamped to 490
		{DeviceID: "dev-mono", WeightG: 480, Timestamp: base.Add(32 * time.Second)}, // insert 480
		{DeviceID: "dev-mono", WeightG: 0, Timestamp: base.Add(40 * time.Second)},   // finish
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.curves) != 2 {
		t.Fatalf("expected 2 curve points, got %d", len(persistence.curves))
	}
	if persistence.curves[0].WeightG != 490 || persistence.curves[1].WeightG != 480 {
		t.Fatalf("expected curve weights [490,480], got [%d,%d]", persistence.curves[0].WeightG, persistence.curves[1].WeightG)
	}
}

type lockingMemoryStore struct {
	memoryDeviceStateStore
	lockCalls   int
	unlockCalls int
}

func newLockingMemoryStore() *lockingMemoryStore {
	return &lockingMemoryStore{
		memoryDeviceStateStore: memoryDeviceStateStore{
			data: make(map[string]DeviceSession),
		},
	}
}

func (s *lockingMemoryStore) Lock(_ context.Context, _ string) (func(), error) {
	s.lockCalls++
	return func() { s.unlockCalls++ }, nil
}

func TestTelemetryUsesDeviceLockWhenAvailable(t *testing.T) {
	store := newLockingMemoryStore()
	svc := NewTelemetryService(store, log.Default())

	_, err := svc.Process(context.Background(), TelemetryInput{
		DeviceID:  "dev-lock",
		WeightG:   100,
		Timestamp: time.Now().UTC(),
	})
	if err != nil {
		t.Fatalf("process telemetry failed: %v", err)
	}
	if store.lockCalls != 1 {
		t.Fatalf("expected lock calls=1, got %d", store.lockCalls)
	}
	if store.unlockCalls != 1 {
		t.Fatalf("expected unlock calls=1, got %d", store.unlockCalls)
	}
}

package service

import (
	"bytes"
	"context"
	"log"
	"strings"
	"testing"
	"time"

	"kxyz-backend/internal/model"
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
	MealID    string
	UserID    string
	StartTime time.Time
}

type curveRecord struct {
	MealID    string
	Timestamp time.Time
	WeightG   int
	Grid1G    int
	Grid2G    int
	Grid3G    int
	Grid4G    int
}

type updatedMealRecord struct {
	MealID          string
	DurationMinutes int
}

type mealGridRecord struct {
	MealID    string
	GridIndex int
	ServedG   int
	LeftoverG int
	IntakeG   int
}

type memoryMealPersistence struct {
	created   []createdMealRecord
	curves    []curveRecord
	updated   []updatedMealRecord
	mealGrids []mealGridRecord
}

func (m *memoryMealPersistence) CreateMeal(
	_ context.Context,
	mealID string,
	userID string,
	startTime time.Time,
) error {
	m.created = append(m.created, createdMealRecord{
		MealID:    mealID,
		UserID:    userID,
		StartTime: startTime.UTC(),
	})
	return nil
}

func (m *memoryMealPersistence) InsertMealCurveData(
	_ context.Context,
	mealID string,
	timestamp time.Time,
	weightG int,
	gridWeights [4]int,
) error {
	m.curves = append(m.curves, curveRecord{
		MealID:    mealID,
		Timestamp: timestamp.UTC(),
		WeightG:   weightG,
		Grid1G:    gridWeights[0],
		Grid2G:    gridWeights[1],
		Grid3G:    gridWeights[2],
		Grid4G:    gridWeights[3],
	})
	return nil
}

func (m *memoryMealPersistence) UpdateMealSummary(_ context.Context, mealID string, durationMinutes int) error {
	m.updated = append(m.updated, updatedMealRecord{
		MealID:          mealID,
		DurationMinutes: durationMinutes,
	})
	return nil
}

func (m *memoryMealPersistence) InsertMealGrids(_ context.Context, mealID string, grids []model.MealGrid) error {
	for _, grid := range grids {
		m.mealGrids = append(m.mealGrids, mealGridRecord{
			MealID:    mealID,
			GridIndex: grid.GridIndex,
			ServedG:   grid.ServedG,
			LeftoverG: grid.LeftoverG,
			IntakeG:   grid.IntakeG,
		})
	}
	return nil
}

func findGridRecord(t *testing.T, rows []mealGridRecord, gridIndex int) mealGridRecord {
	t.Helper()
	for _, row := range rows {
		if row.GridIndex == gridIndex {
			return row
		}
	}
	t.Fatalf("grid_index=%d not found", gridIndex)
	return mealGridRecord{}
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
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 450, Timestamp: base.Add(16 * time.Second)},
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 400, Timestamp: base.Add(20 * time.Second)},
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 0, Timestamp: base.Add(25 * time.Second)},
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.created) != 1 {
		t.Fatalf("expected 1 meal insert, got %d", len(persistence.created))
	}
	if persistence.created[0].UserID != "user-1" {
		t.Fatalf("expected user_id=user-1, got %s", persistence.created[0].UserID)
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
	if len(persistence.mealGrids) != 4 {
		t.Fatalf("expected 4 meal grids, got %d", len(persistence.mealGrids))
	}
	grid1 := findGridRecord(t, persistence.mealGrids, 1)
	if grid1.ServedG != 500 || grid1.LeftoverG != 400 || grid1.IntakeG != 100 {
		t.Fatalf("expected grid1 served=500 leftover=400 intake=100, got served=%d leftover=%d intake=%d", grid1.ServedG, grid1.LeftoverG, grid1.IntakeG)
	}
	for _, idx := range []int{2, 3, 4} {
		grid := findGridRecord(t, persistence.mealGrids, idx)
		if grid.ServedG != 0 || grid.LeftoverG != 0 || grid.IntakeG != 0 {
			t.Fatalf("expected grid%d all zero, got served=%d leftover=%d intake=%d", idx, grid.ServedG, grid.LeftoverG, grid.IntakeG)
		}
	}
}

func TestTelemetryServingTransitionsAfterContinuous15Seconds(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 14, 9, 34, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-5s", UserID: "user-5", WeightG: 500, Timestamp: base},                       // IDLE -> SERVING
		{DeviceID: "dev-5s", UserID: "user-5", WeightG: 450, Timestamp: base.Add(5 * time.Second)},  // SERVING
		{DeviceID: "dev-5s", UserID: "user-5", WeightG: 430, Timestamp: base.Add(10 * time.Second)}, // SERVING
		{DeviceID: "dev-5s", UserID: "user-5", WeightG: 420, Timestamp: base.Add(15 * time.Second)}, // SERVING -> EATING
	}

	var last TelemetryResult
	for _, input := range inputs {
		result, err := svc.Process(ctx, input)
		if err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
		last = result
	}

	if last.CurrentState != StateEating {
		t.Fatalf("expected final state EATING, got %s", last.CurrentState)
	}
	if len(persistence.created) != 1 {
		t.Fatalf("expected 1 meal insert, got %d", len(persistence.created))
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
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 450, Timestamp: base.Add(16 * time.Second)}, // SERVING -> EATING
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 300, Timestamp: base.Add(20 * time.Second)}, // EATING
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 800, Timestamp: base.Add(24 * time.Second)}, // EATING -> SERVING (refill)
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 780, Timestamp: base.Add(40 * time.Second)}, // SERVING -> EATING, add served
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 700, Timestamp: base.Add(44 * time.Second)}, // EATING
		{DeviceID: "dev-1", UserID: "user-1", WeightG: 0, Timestamp: base.Add(50 * time.Second)},   // EATING -> IDLE
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.created) != 1 {
		t.Fatalf("expected 1 meal creation, got %d", len(persistence.created))
	}
	if len(persistence.updated) != 1 {
		t.Fatalf("expected 1 summary update, got %d", len(persistence.updated))
	}
	if len(persistence.mealGrids) != 4 {
		t.Fatalf("expected 4 meal grids, got %d", len(persistence.mealGrids))
	}
	grid1 := findGridRecord(t, persistence.mealGrids, 1)
	if grid1.ServedG != 1000 || grid1.LeftoverG != 700 || grid1.IntakeG != 300 {
		t.Fatalf("expected grid1 served=1000 leftover=700 intake=300, got served=%d leftover=%d intake=%d", grid1.ServedG, grid1.LeftoverG, grid1.IntakeG)
	}
}

func TestTelemetryEndsEatingAfterStable600Seconds(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 13, 13, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-stable", UserID: "user-stable", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-stable", UserID: "user-stable", WeightG: 490, Timestamp: base.Add(16 * time.Second)},                // SERVING -> EATING
		{DeviceID: "dev-stable", UserID: "user-stable", WeightG: 490, Timestamp: base.Add(10*time.Minute + 20*time.Second)}, // stable >=600s
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
	if len(persistence.mealGrids) != 4 {
		t.Fatalf("expected 4 meal grids, got %d", len(persistence.mealGrids))
	}
	grid1 := findGridRecord(t, persistence.mealGrids, 1)
	if grid1.LeftoverG != 490 {
		t.Fatalf("expected grid1 leftover=490, got %d", grid1.LeftoverG)
	}
}

func TestTelemetryPersistsFourGridSummaryOnMealFinish(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 15, 9, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{
			DeviceID:    "dev-grid",
			UserID:      "user-grid",
			GridWeights: [4]int{100, 200, 300, 400},
			Timestamp:   base,
		},
		{
			DeviceID:    "dev-grid",
			UserID:      "user-grid",
			GridWeights: [4]int{95, 190, 280, 370},
			Timestamp:   base.Add(16 * time.Second),
		},
		{
			DeviceID:    "dev-grid",
			UserID:      "user-grid",
			GridWeights: [4]int{80, 170, 250, 350},
			Timestamp:   base.Add(20 * time.Second),
		},
		{
			DeviceID:    "dev-grid",
			UserID:      "user-grid",
			GridWeights: [4]int{0, 0, 0, 0},
			Timestamp:   base.Add(24 * time.Second),
		},
	}

	for _, input := range inputs {
		if _, err := svc.Process(ctx, input); err != nil {
			t.Fatalf("process telemetry failed: %v", err)
		}
	}

	if len(persistence.mealGrids) != 4 {
		t.Fatalf("expected 4 meal grids, got %d", len(persistence.mealGrids))
	}

	grid1 := findGridRecord(t, persistence.mealGrids, 1)
	if grid1.ServedG != 100 || grid1.LeftoverG != 80 || grid1.IntakeG != 20 {
		t.Fatalf("expected grid1 served=100 leftover=80 intake=20, got served=%d leftover=%d intake=%d", grid1.ServedG, grid1.LeftoverG, grid1.IntakeG)
	}
	grid2 := findGridRecord(t, persistence.mealGrids, 2)
	if grid2.ServedG != 200 || grid2.LeftoverG != 170 || grid2.IntakeG != 30 {
		t.Fatalf("expected grid2 served=200 leftover=170 intake=30, got served=%d leftover=%d intake=%d", grid2.ServedG, grid2.LeftoverG, grid2.IntakeG)
	}
	grid3 := findGridRecord(t, persistence.mealGrids, 3)
	if grid3.ServedG != 300 || grid3.LeftoverG != 250 || grid3.IntakeG != 50 {
		t.Fatalf("expected grid3 served=300 leftover=250 intake=50, got served=%d leftover=%d intake=%d", grid3.ServedG, grid3.LeftoverG, grid3.IntakeG)
	}
	grid4 := findGridRecord(t, persistence.mealGrids, 4)
	if grid4.ServedG != 400 || grid4.LeftoverG != 350 || grid4.IntakeG != 50 {
		t.Fatalf("expected grid4 served=400 leftover=350 intake=50, got served=%d leftover=%d intake=%d", grid4.ServedG, grid4.LeftoverG, grid4.IntakeG)
	}
}

func TestTelemetryEnforcesMonotonicCurveInEatingState(t *testing.T) {
	store := newMemoryDeviceStateStore()
	persistence := &memoryMealPersistence{}
	svc := NewTelemetryService(store, log.Default(), persistence)
	ctx := context.Background()

	base := time.Date(2026, 3, 13, 14, 0, 0, 0, time.UTC)
	inputs := []TelemetryInput{
		{DeviceID: "dev-mono", UserID: "user-mono", WeightG: 500, Timestamp: base},
		{DeviceID: "dev-mono", UserID: "user-mono", WeightG: 490, Timestamp: base.Add(16 * time.Second)}, // SERVING -> EATING, insert 490
		{DeviceID: "dev-mono", UserID: "user-mono", WeightG: 495, Timestamp: base.Add(24 * time.Second)}, // should be clamped to 490
		{DeviceID: "dev-mono", UserID: "user-mono", WeightG: 480, Timestamp: base.Add(32 * time.Second)}, // insert 480
		{DeviceID: "dev-mono", UserID: "user-mono", WeightG: 0, Timestamp: base.Add(40 * time.Second)},   // finish
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

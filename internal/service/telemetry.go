package service

import (
	"context"
	"crypto/sha1"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

const (
	StateIdle    = "IDLE"
	StateServing = "SERVING"
	StateEating  = "EATING"
)

type TelemetryInput struct {
	DeviceID  string
	WeightG   int
	Timestamp time.Time
}

type TelemetryResult struct {
	DeviceID      string
	PreviousState string
	CurrentState  string
}

type DeviceSession struct {
	CurrentState      string
	LastWeight        int
	LastTimestamp     int64
	TempPeakWeight    int
	ActiveMealID      string
	ActiveMealStartTS int64
}

type DeviceStateStore interface {
	Load(ctx context.Context, deviceID string) (DeviceSession, error)
	Save(ctx context.Context, deviceID string, session DeviceSession) error
}

type MealPersistence interface {
	CreateMeal(ctx context.Context, mealID string, startTime time.Time, totalServedG int) error
	InsertMealCurveData(ctx context.Context, mealID string, timestamp time.Time, weightG int) error
	UpdateMealSummary(ctx context.Context, mealID string, durationMinutes int, totalLeftoverG int) error
}

type noopMealPersistence struct{}

func (noopMealPersistence) CreateMeal(_ context.Context, _ string, _ time.Time, _ int) error {
	return nil
}

func (noopMealPersistence) InsertMealCurveData(_ context.Context, _ string, _ time.Time, _ int) error {
	return nil
}

func (noopMealPersistence) UpdateMealSummary(_ context.Context, _ string, _ int, _ int) error {
	return nil
}

type TelemetryService struct {
	store       DeviceStateStore
	persistence MealPersistence
	logger      *log.Logger
}

func NewTelemetryService(store DeviceStateStore, logger *log.Logger, persistence ...MealPersistence) *TelemetryService {
	target := MealPersistence(noopMealPersistence{})
	if len(persistence) > 0 && persistence[0] != nil {
		target = persistence[0]
	}

	return &TelemetryService{
		store:       store,
		persistence: target,
		logger:      logger,
	}
}

func (s *TelemetryService) Process(ctx context.Context, input TelemetryInput) (TelemetryResult, error) {
	session, err := s.store.Load(ctx, input.DeviceID)
	if err != nil {
		return TelemetryResult{}, err
	}

	if session.CurrentState == "" {
		session.CurrentState = StateIdle
	}

	previousState := session.CurrentState
	delta := input.WeightG - session.LastWeight

	if abs(delta) < 5 {
		s.logger.Printf("[死区拦截] 不执行动作 device=%s delta=%dg", input.DeviceID, delta)
		return TelemetryResult{
			DeviceID:      input.DeviceID,
			PreviousState: previousState,
			CurrentState:  session.CurrentState,
		}, nil
	}

	switch session.CurrentState {
	case StateIdle:
		if delta > 50 {
			s.logger.Printf("[状态跃迁] IDLE -> SERVING device=%s", input.DeviceID)
			session.CurrentState = StateServing
			session.TempPeakWeight = input.WeightG
		}
	case StateServing:
		if input.WeightG > session.TempPeakWeight {
			session.TempPeakWeight = input.WeightG
		}
		if delta <= 0 && session.LastTimestamp > 0 &&
			input.Timestamp.Sub(time.Unix(session.LastTimestamp, 0)) >= 15*time.Second {
			session.ActiveMealID = newMealID(input.DeviceID, input.Timestamp)
			if err := s.persistence.CreateMeal(ctx, session.ActiveMealID, input.Timestamp, session.TempPeakWeight); err != nil {
				return TelemetryResult{}, fmt.Errorf("create meal: %w", err)
			}
			s.logger.Printf("[状态跃迁] SERVING -> EATING device=%s", input.DeviceID)
			session.ActiveMealStartTS = input.Timestamp.Unix()
			session.CurrentState = StateEating
			if input.WeightG >= 10 {
				if err := s.persistence.InsertMealCurveData(ctx, session.ActiveMealID, input.Timestamp, input.WeightG); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
		}
	case StateEating:
		if input.WeightG < 10 {
			s.logger.Printf("[状态跃迁] EATING -> IDLE device=%s", input.DeviceID)
			durationMinutes := durationMinutes(session.ActiveMealStartTS, input.Timestamp.Unix())
			totalLeftoverG := session.LastWeight
			if totalLeftoverG < 0 {
				totalLeftoverG = 0
			}
			if err := s.persistence.UpdateMealSummary(ctx, session.ActiveMealID, durationMinutes, totalLeftoverG); err != nil {
				return TelemetryResult{}, fmt.Errorf("update meal summary: %w", err)
			}
			session.CurrentState = StateIdle
			session.ActiveMealID = ""
			session.ActiveMealStartTS = 0
			session.TempPeakWeight = 0
		} else {
			if input.WeightG != session.LastWeight {
				if err := s.persistence.InsertMealCurveData(ctx, session.ActiveMealID, input.Timestamp, input.WeightG); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
		}
	}

	session.LastWeight = input.WeightG
	session.LastTimestamp = input.Timestamp.Unix()
	if err := s.store.Save(ctx, input.DeviceID, session); err != nil {
		return TelemetryResult{}, err
	}

	return TelemetryResult{
		DeviceID:      input.DeviceID,
		PreviousState: previousState,
		CurrentState:  session.CurrentState,
	}, nil
}

type RedisDeviceStateStore struct {
	client *redis.Client
}

func NewRedisDeviceStateStore(client *redis.Client) *RedisDeviceStateStore {
	return &RedisDeviceStateStore{client: client}
}

func (s *RedisDeviceStateStore) Load(ctx context.Context, deviceID string) (DeviceSession, error) {
	values, err := s.client.HGetAll(ctx, redisDeviceKey(deviceID)).Result()
	if err != nil {
		return DeviceSession{}, fmt.Errorf("read redis state: %w", err)
	}
	if len(values) == 0 {
		return DeviceSession{CurrentState: StateIdle}, nil
	}

	session := DeviceSession{
		CurrentState:      values["current_state"],
		ActiveMealID:      values["active_meal_id"],
		ActiveMealStartTS: parseInt64(values["active_meal_start_ts"]),
		LastWeight:        parseInt(values["last_weight"]),
		LastTimestamp:     parseInt64(values["last_timestamp"]),
		TempPeakWeight:    parseInt(values["temp_peak_weight"]),
	}
	if session.CurrentState == "" {
		session.CurrentState = StateIdle
	}
	return session, nil
}

func (s *RedisDeviceStateStore) Save(ctx context.Context, deviceID string, session DeviceSession) error {
	data := map[string]any{
		"current_state":        session.CurrentState,
		"last_weight":          session.LastWeight,
		"last_timestamp":       session.LastTimestamp,
		"temp_peak_weight":     session.TempPeakWeight,
		"active_meal_id":       session.ActiveMealID,
		"active_meal_start_ts": session.ActiveMealStartTS,
	}
	if err := s.client.HSet(ctx, redisDeviceKey(deviceID), data).Err(); err != nil {
		return fmt.Errorf("write redis state: %w", err)
	}
	return nil
}

func redisDeviceKey(deviceID string) string {
	return "device:" + deviceID
}

func newMealID(deviceID string, t time.Time) string {
	sum := sha1.Sum([]byte(deviceID))
	return fmt.Sprintf("%019d-%x", t.UTC().UnixNano(), sum[:8])
}

func parseInt(value string) int {
	n, err := strconv.Atoi(value)
	if err != nil {
		return 0
	}
	return n
}

func parseInt64(value string) int64 {
	n, err := strconv.ParseInt(value, 10, 64)
	if err != nil {
		return 0
	}
	return n
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func durationMinutes(startUnix int64, endUnix int64) int {
	if startUnix <= 0 || endUnix <= startUnix {
		return 0
	}
	return int((endUnix - startUnix) / 60)
}

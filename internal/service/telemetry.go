package service

import (
	"context"
	"crypto/rand"
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
	ServingBaseWeight int
	ActiveMealID      string
	ActiveMealStartTS int64
	EatingStableTS    int64
}

type DeviceStateStore interface {
	Load(ctx context.Context, deviceID string) (DeviceSession, error)
	Save(ctx context.Context, deviceID string, session DeviceSession) error
}

type MealPersistence interface {
	CreateMeal(ctx context.Context, mealID string, startTime time.Time, totalServedG int) error
	AddMealServedG(ctx context.Context, mealID string, servedIncrement int) error
	InsertMealCurveData(ctx context.Context, mealID string, timestamp time.Time, weightG int) error
	UpdateMealSummary(ctx context.Context, mealID string, durationMinutes int, totalLeftoverG int) error
}

type noopMealPersistence struct{}

func (noopMealPersistence) CreateMeal(_ context.Context, _ string, _ time.Time, _ int) error {
	return nil
}

func (noopMealPersistence) AddMealServedG(_ context.Context, _ string, _ int) error {
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

type deviceStateLocker interface {
	Lock(ctx context.Context, deviceID string) (func(), error)
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
	unlock := func() {}
	if locker, ok := s.store.(deviceStateLocker); ok {
		var err error
		unlock, err = locker.Lock(ctx, input.DeviceID)
		if err != nil {
			return TelemetryResult{}, err
		}
	}
	defer unlock()

	session, err := s.store.Load(ctx, input.DeviceID)
	if err != nil {
		return TelemetryResult{}, err
	}

	if session.CurrentState == "" {
		session.CurrentState = StateIdle
	}

	previousState := session.CurrentState
	delta := input.WeightG - session.LastWeight
	weightForSave := input.WeightG

	if session.CurrentState != StateEating && abs(delta) < 5 {
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
			session.ServingBaseWeight = 0
			session.TempPeakWeight = input.WeightG
		}
	case StateServing:
		if input.WeightG > session.TempPeakWeight {
			session.TempPeakWeight = input.WeightG
		}
		if delta <= 0 && session.LastTimestamp > 0 &&
			input.Timestamp.Sub(time.Unix(session.LastTimestamp, 0)) >= 15*time.Second {
			servedIncrement := session.TempPeakWeight - session.ServingBaseWeight
			if servedIncrement < 0 {
				servedIncrement = 0
			}

			if session.ActiveMealID == "" {
				session.ActiveMealID = newMealID(input.DeviceID, input.Timestamp)
				if err := s.persistence.CreateMeal(ctx, session.ActiveMealID, input.Timestamp, servedIncrement); err != nil {
					return TelemetryResult{}, fmt.Errorf("create meal: %w", err)
				}
				session.ActiveMealStartTS = input.Timestamp.Unix()
			} else if servedIncrement > 0 {
				if err := s.persistence.AddMealServedG(ctx, session.ActiveMealID, servedIncrement); err != nil {
					return TelemetryResult{}, fmt.Errorf("add meal served amount: %w", err)
				}
			}

			s.logger.Printf("[状态跃迁] SERVING -> EATING device=%s", input.DeviceID)
			session.CurrentState = StateEating

			if input.WeightG >= 10 {
				if err := s.persistence.InsertMealCurveData(ctx, session.ActiveMealID, input.Timestamp, input.WeightG); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
		}
	case StateEating:
		if delta > 50 {
			s.logger.Printf("[状态跃迁] EATING -> SERVING device=%s reason=refill", input.DeviceID)
			session.CurrentState = StateServing
			session.ServingBaseWeight = session.LastWeight
			session.TempPeakWeight = input.WeightG
			session.EatingStableTS = 0
			weightForSave = input.WeightG
			break
		}

		effectiveWeight := input.WeightG
		if effectiveWeight > session.LastWeight {
			// In EATING state we enforce a monotonic non-increasing trajectory.
			effectiveWeight = session.LastWeight
		}
		effectiveDelta := effectiveWeight - session.LastWeight

		if abs(effectiveDelta) < 5 {
			s.logger.Printf("[死区拦截] 不执行动作 device=%s delta=%dg", input.DeviceID, effectiveDelta)
			if abs(effectiveDelta) < 1 {
				if session.EatingStableTS == 0 {
					if session.LastTimestamp > 0 {
						session.EatingStableTS = session.LastTimestamp
					} else {
						session.EatingStableTS = input.Timestamp.Unix()
					}
				}
				if input.Timestamp.Unix()-session.EatingStableTS >= 600 {
					if err := s.finishMeal(ctx, &session, input.DeviceID, input.Timestamp.Unix()); err != nil {
						return TelemetryResult{}, err
					}
				}
			} else {
				session.EatingStableTS = 0
			}
			weightForSave = session.LastWeight
			break
		}

		session.EatingStableTS = 0

		if effectiveWeight < 10 {
			if err := s.finishMeal(ctx, &session, input.DeviceID, input.Timestamp.Unix()); err != nil {
				return TelemetryResult{}, err
			}
			weightForSave = effectiveWeight
		} else {
			if effectiveWeight != session.LastWeight {
				if err := s.persistence.InsertMealCurveData(ctx, session.ActiveMealID, input.Timestamp, effectiveWeight); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
			weightForSave = effectiveWeight
		}
	}

	session.LastWeight = weightForSave
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

func (s *TelemetryService) finishMeal(ctx context.Context, session *DeviceSession, deviceID string, endUnix int64) error {
	s.logger.Printf("[状态跃迁] EATING -> IDLE device=%s", deviceID)

	durationMinutes := durationMinutes(session.ActiveMealStartTS, endUnix)
	totalLeftoverG := session.LastWeight
	if totalLeftoverG < 0 {
		totalLeftoverG = 0
	}
	if err := s.persistence.UpdateMealSummary(ctx, session.ActiveMealID, durationMinutes, totalLeftoverG); err != nil {
		return fmt.Errorf("update meal summary: %w", err)
	}

	session.CurrentState = StateIdle
	session.ActiveMealID = ""
	session.ActiveMealStartTS = 0
	session.ServingBaseWeight = 0
	session.TempPeakWeight = 0
	session.EatingStableTS = 0
	return nil
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
		ServingBaseWeight: parseInt(values["serving_base_weight"]),
		LastWeight:        parseInt(values["last_weight"]),
		LastTimestamp:     parseInt64(values["last_timestamp"]),
		TempPeakWeight:    parseInt(values["temp_peak_weight"]),
		EatingStableTS:    parseInt64(values["eating_stable_ts"]),
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
		"serving_base_weight":  session.ServingBaseWeight,
		"active_meal_id":       session.ActiveMealID,
		"active_meal_start_ts": session.ActiveMealStartTS,
		"eating_stable_ts":     session.EatingStableTS,
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

func (s *RedisDeviceStateStore) Lock(ctx context.Context, deviceID string) (func(), error) {
	lockKey := redisDeviceLockKey(deviceID)
	token, err := randomHex(16)
	if err != nil {
		return nil, fmt.Errorf("generate lock token: %w", err)
	}

	deadline := time.Now().Add(2 * time.Second)
	for {
		ok, err := s.client.SetNX(ctx, lockKey, token, 5*time.Second).Result()
		if err != nil {
			return nil, fmt.Errorf("acquire redis lock: %w", err)
		}
		if ok {
			break
		}
		if time.Now().After(deadline) {
			return nil, fmt.Errorf("acquire redis lock timeout")
		}
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		time.Sleep(10 * time.Millisecond)
	}

	unlock := func() {
		_, _ = s.client.Eval(
			context.Background(),
			"if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
			[]string{lockKey},
			token,
		).Result()
	}
	return unlock, nil
}

func redisDeviceLockKey(deviceID string) string {
	return "device_lock:" + deviceID
}

func randomHex(size int) (string, error) {
	raw := make([]byte, size)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	return fmt.Sprintf("%x", raw), nil
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

package service

import (
	"context"
	"crypto/rand"
	"crypto/sha1"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"kxyz-backend/internal/model"

	"github.com/redis/go-redis/v9"
)

const (
	StateIdle    = "IDLE"
	StateServing = "SERVING"
	StateEating  = "EATING"
)

type TelemetryInput struct {
	DeviceID    string
	UserID      string
	WeightG     int
	GridWeights [4]int
	Timestamp   time.Time
}

type TelemetryResult struct {
	DeviceID      string
	PreviousState string
	CurrentState  string
}

type DeviceSession struct {
	CurrentState           string
	LastWeight             int
	LastGridWeights        [4]int
	LastTimestamp          int64
	TempPeakWeight         int
	TempPeakGridWeights    [4]int
	ServingBaseWeight      int
	ServingBaseGridWeights [4]int
	ServingStableTS        int64
	ServedGridTotals       [4]int
	ActiveMealID           string
	ActiveUserID           string
	ActiveMealStartTS      int64
	EatingStableTS         int64
}

type DeviceStateStore interface {
	Load(ctx context.Context, deviceID string) (DeviceSession, error)
	Save(ctx context.Context, deviceID string, session DeviceSession) error
}

type MealPersistence interface {
	CreateMeal(ctx context.Context, mealID string, userID string, startTime time.Time) error
	InsertMealCurveData(ctx context.Context, mealID string, timestamp time.Time, weightG int, gridWeights [4]int) error
	UpdateMealSummary(ctx context.Context, mealID string, durationMinutes int) error
	InsertMealGrids(ctx context.Context, mealID string, grids []model.MealGrid) error
}

type noopMealPersistence struct{}

func (noopMealPersistence) CreateMeal(_ context.Context, _ string, _ string, _ time.Time) error {
	return nil
}

func (noopMealPersistence) InsertMealCurveData(_ context.Context, _ string, _ time.Time, _ int, _ [4]int) error {
	return nil
}

func (noopMealPersistence) UpdateMealSummary(_ context.Context, _ string, _ int) error {
	return nil
}

func (noopMealPersistence) InsertMealGrids(_ context.Context, _ string, _ []model.MealGrid) error {
	return nil
}

type TelemetryService struct {
	store       DeviceStateStore
	persistence MealPersistence
	alerts      MealAlertChecker
	logger      *log.Logger
}

type MealAlertMetrics struct {
	DurationMinutes int
	TotalServedG    int
	TotalIntakeG    int
	TotalLeftoverG  int
	SpeedGPerMin    float64
}

type MealAlertChecker interface {
	CheckMealAlerts(ctx context.Context, mealID string, userID string, metrics MealAlertMetrics) error
}

type noopMealAlertChecker struct{}

func (noopMealAlertChecker) CheckMealAlerts(_ context.Context, _ string, _ string, _ MealAlertMetrics) error {
	return nil
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
		alerts:      noopMealAlertChecker{},
		logger:      logger,
	}
}

func (s *TelemetryService) WithMealAlertChecker(checker MealAlertChecker) *TelemetryService {
	if checker != nil {
		s.alerts = checker
	}
	return s
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

	gridWeights := resolveInputGridWeights(input)
	inputWeight := sumGridWeights(gridWeights)

	previousState := session.CurrentState
	delta := inputWeight - session.LastWeight
	weightForSave := inputWeight
	gridWeightsForSave := gridWeights

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
			session.ServingBaseGridWeights = [4]int{}
			session.TempPeakGridWeights = gridWeights
			session.TempPeakWeight = inputWeight
			session.ServingStableTS = 0
		}
	case StateServing:
		if hasGridIncrease(gridWeights, session.TempPeakGridWeights) {
			session.TempPeakGridWeights = maxGridWeights(session.TempPeakGridWeights, gridWeights)
			session.TempPeakWeight = sumGridWeights(session.TempPeakGridWeights)
			session.ServingStableTS = 0
		}
		if delta > 0 {
			session.ServingStableTS = 0
			break
		}

		if session.ServingStableTS == 0 {
			if session.LastTimestamp > 0 {
				session.ServingStableTS = session.LastTimestamp
			} else {
				session.ServingStableTS = input.Timestamp.Unix()
			}
		}

		if input.Timestamp.Unix()-session.ServingStableTS >= 15 {
			if session.ActiveMealID == "" {
				session.ActiveMealID = newMealID(input.DeviceID, input.Timestamp)
				if err := s.persistence.CreateMeal(ctx, session.ActiveMealID, input.UserID, input.Timestamp); err != nil {
					return TelemetryResult{}, fmt.Errorf("create meal: %w", err)
				}
				session.ActiveUserID = input.UserID
				session.ActiveMealStartTS = input.Timestamp.Unix()
			}

			for i := 0; i < 4; i++ {
				servedIncrement := session.TempPeakGridWeights[i] - session.ServingBaseGridWeights[i]
				if servedIncrement < 0 {
					servedIncrement = 0
				}
				session.ServedGridTotals[i] += servedIncrement
			}

			s.logger.Printf("[状态跃迁] SERVING -> EATING device=%s", input.DeviceID)
			session.CurrentState = StateEating
			session.ServingStableTS = 0

			if inputWeight >= 10 {
				if err := s.persistence.InsertMealCurveData(
					ctx,
					session.ActiveMealID,
					input.Timestamp,
					inputWeight,
					gridWeights,
				); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
		}
	case StateEating:
		if delta > 50 {
			s.logger.Printf("[状态跃迁] EATING -> SERVING device=%s reason=refill", input.DeviceID)
			session.CurrentState = StateServing
			session.ServingBaseWeight = session.LastWeight
			session.ServingBaseGridWeights = session.LastGridWeights
			session.TempPeakGridWeights = gridWeights
			session.TempPeakWeight = inputWeight
			session.EatingStableTS = 0
			weightForSave = inputWeight
			gridWeightsForSave = gridWeights
			break
		}

		effectiveGridWeights := gridWeights
		for i := 0; i < 4; i++ {
			if effectiveGridWeights[i] > session.LastGridWeights[i] {
				// In EATING state we enforce a monotonic non-increasing trajectory.
				effectiveGridWeights[i] = session.LastGridWeights[i]
			}
		}
		effectiveWeight := sumGridWeights(effectiveGridWeights)
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
			gridWeightsForSave = session.LastGridWeights
			break
		}

		session.EatingStableTS = 0

		if effectiveWeight < 10 {
			if err := s.finishMeal(ctx, &session, input.DeviceID, input.Timestamp.Unix()); err != nil {
				return TelemetryResult{}, err
			}
			weightForSave = effectiveWeight
			gridWeightsForSave = effectiveGridWeights
		} else {
			if effectiveWeight != session.LastWeight {
				if err := s.persistence.InsertMealCurveData(
					ctx,
					session.ActiveMealID,
					input.Timestamp,
					effectiveWeight,
					effectiveGridWeights,
				); err != nil {
					return TelemetryResult{}, fmt.Errorf("insert meal curve data: %w", err)
				}
			}
			weightForSave = effectiveWeight
			gridWeightsForSave = effectiveGridWeights
		}
	}

	session.LastWeight = weightForSave
	session.LastGridWeights = gridWeightsForSave
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
	if session.ActiveMealID == "" {
		session.CurrentState = StateIdle
		return nil
	}

	durationMinutes := durationMinutes(session.ActiveMealStartTS, endUnix)
	if err := s.persistence.UpdateMealSummary(ctx, session.ActiveMealID, durationMinutes); err != nil {
		return fmt.Errorf("update meal summary: %w", err)
	}

	grids := make([]model.MealGrid, 0, 4)
	for i := 0; i < 4; i++ {
		served := session.ServedGridTotals[i]
		if served < 0 {
			served = 0
		}
		leftover := session.LastGridWeights[i]
		if leftover < 0 {
			leftover = 0
		}
		intake := served - leftover
		if intake < 0 {
			intake = 0
		}

		grids = append(grids, model.MealGrid{
			GridIndex: i + 1,
			ServedG:   served,
			LeftoverG: leftover,
			IntakeG:   intake,
		})
	}
	if err := s.persistence.InsertMealGrids(ctx, session.ActiveMealID, grids); err != nil {
		return fmt.Errorf("insert meal grids: %w", err)
	}

	metrics := buildMealAlertMetrics(durationMinutes, grids)
	if session.ActiveUserID != "" {
		if err := s.alerts.CheckMealAlerts(ctx, session.ActiveMealID, session.ActiveUserID, metrics); err != nil {
			s.logger.Printf("[告警检查失败] meal_id=%s user_id=%s err=%v", session.ActiveMealID, session.ActiveUserID, err)
		}
	}

	session.CurrentState = StateIdle
	session.ActiveMealID = ""
	session.ActiveUserID = ""
	session.ActiveMealStartTS = 0
	session.ServingBaseWeight = 0
	session.ServingBaseGridWeights = [4]int{}
	session.TempPeakWeight = 0
	session.TempPeakGridWeights = [4]int{}
	session.ServedGridTotals = [4]int{}
	session.ServingStableTS = 0
	session.EatingStableTS = 0
	return nil
}

func buildMealAlertMetrics(durationMinutes int, grids []model.MealGrid) MealAlertMetrics {
	metrics := MealAlertMetrics{DurationMinutes: durationMinutes}
	for _, grid := range grids {
		metrics.TotalServedG += grid.ServedG
		metrics.TotalIntakeG += grid.IntakeG
		metrics.TotalLeftoverG += grid.LeftoverG
	}
	if durationMinutes > 0 {
		metrics.SpeedGPerMin = float64(metrics.TotalIntakeG) / float64(durationMinutes)
	}
	return metrics
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
		CurrentState:           values["current_state"],
		ActiveMealID:           values["active_meal_id"],
		ActiveUserID:           values["active_user_id"],
		ActiveMealStartTS:      parseInt64(values["active_meal_start_ts"]),
		ServingBaseWeight:      parseInt(values["serving_base_weight"]),
		ServingBaseGridWeights: parseGridWeights(values["serving_base_grid_weights"]),
		ServingStableTS:        parseInt64(values["serving_stable_ts"]),
		LastWeight:             parseInt(values["last_weight"]),
		LastGridWeights:        parseGridWeights(values["last_grid_weights"]),
		LastTimestamp:          parseInt64(values["last_timestamp"]),
		TempPeakWeight:         parseInt(values["temp_peak_weight"]),
		TempPeakGridWeights:    parseGridWeights(values["temp_peak_grid_weights"]),
		ServedGridTotals:       parseGridWeights(values["served_grid_totals"]),
		EatingStableTS:         parseInt64(values["eating_stable_ts"]),
	}
	if session.LastWeight > 0 && sumGridWeights(session.LastGridWeights) == 0 {
		session.LastGridWeights[0] = session.LastWeight
	}
	if session.TempPeakWeight > 0 && sumGridWeights(session.TempPeakGridWeights) == 0 {
		session.TempPeakGridWeights[0] = session.TempPeakWeight
	}
	if session.ServingBaseWeight > 0 && sumGridWeights(session.ServingBaseGridWeights) == 0 {
		session.ServingBaseGridWeights[0] = session.ServingBaseWeight
	}
	if session.CurrentState == "" {
		session.CurrentState = StateIdle
	}
	return session, nil
}

func (s *RedisDeviceStateStore) Save(ctx context.Context, deviceID string, session DeviceSession) error {
	data := map[string]any{
		"current_state":             session.CurrentState,
		"last_weight":               session.LastWeight,
		"last_grid_weights":         formatGridWeights(session.LastGridWeights),
		"last_timestamp":            session.LastTimestamp,
		"temp_peak_weight":          session.TempPeakWeight,
		"temp_peak_grid_weights":    formatGridWeights(session.TempPeakGridWeights),
		"serving_base_weight":       session.ServingBaseWeight,
		"serving_base_grid_weights": formatGridWeights(session.ServingBaseGridWeights),
		"served_grid_totals":        formatGridWeights(session.ServedGridTotals),
		"serving_stable_ts":         session.ServingStableTS,
		"active_meal_id":            session.ActiveMealID,
		"active_user_id":            session.ActiveUserID,
		"active_meal_start_ts":      session.ActiveMealStartTS,
		"eating_stable_ts":          session.EatingStableTS,
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

func resolveInputGridWeights(input TelemetryInput) [4]int {
	if sumGridWeights(input.GridWeights) == 0 && input.WeightG != 0 {
		return [4]int{input.WeightG, 0, 0, 0}
	}
	return input.GridWeights
}

func sumGridWeights(weights [4]int) int {
	return weights[0] + weights[1] + weights[2] + weights[3]
}

func hasGridIncrease(next [4]int, previous [4]int) bool {
	for i := 0; i < 4; i++ {
		if next[i] > previous[i] {
			return true
		}
	}
	return false
}

func maxGridWeights(a [4]int, b [4]int) [4]int {
	out := a
	for i := 0; i < 4; i++ {
		if b[i] > out[i] {
			out[i] = b[i]
		}
	}
	return out
}

func parseGridWeights(value string) [4]int {
	var weights [4]int
	if value == "" {
		return weights
	}

	parts := strings.Split(value, ",")
	for i := 0; i < 4 && i < len(parts); i++ {
		weights[i] = parseInt(strings.TrimSpace(parts[i]))
	}
	return weights
}

func formatGridWeights(weights [4]int) string {
	return fmt.Sprintf("%d,%d,%d,%d", weights[0], weights[1], weights[2], weights[3])
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

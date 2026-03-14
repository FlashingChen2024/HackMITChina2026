/**
 * 智能餐盒遥测处理与状态机（新 API：weight_g 单值，返回 state）
 * 按 device_id 维护 IDLE → SERVING → EATING → IDLE，写 Lunchbox_Meals / Meal_Curve_Data，结算时同步 Meal_Records
 * @module services/telemetryService
 */

const db = require('../config/db');
const { getUserIdByDeviceId } = require('./deviceBindingService');
const { unixToRFC3339 } = require('../utils/time');

/** 状态机阈值 */
const THRESHOLD = {
  DEADBAND_G: 5,
  SERVING_DELTA_G: 50,
  SERVING_TIME_WINDOW_S: 60,
  EATING_DECREASE_DURATION_S: 15,
  SETTLE_WEIGHT_G: 10,
  SETTLE_STABLE_DELTA_G: 1,
  SETTLE_STABLE_DURATION_S: 600
};

const deviceStates = new Map();

function getOrInitState(deviceId) {
  let s = deviceStates.get(deviceId);
  if (!s) {
    s = {
      state: 'IDLE',
      last_total_weight: 0,
      last_timestamp: 0
    };
    deviceStates.set(deviceId, s);
  }
  return s;
}

async function settleMeal(deviceId, mealId, totalLeftoverG, endTimestamp) {
  const userId = await getUserIdByDeviceId(deviceId) || 0;
  const rows = await db.query(
    'SELECT start_time, total_served_g FROM Lunchbox_Meals WHERE meal_id = ? LIMIT 1',
    [mealId]
  );
  if (!rows || !rows[0]) return;
  const startTime = Number(rows[0].start_time);
  const totalServedG = Number(rows[0].total_served_g) || 0;
  const durationMinutes = Math.max(0, Math.round((endTimestamp - startTime) / 60));
  const totalIntakeG = Math.max(0, totalServedG - totalLeftoverG);
  const eatingSpeed = durationMinutes > 0 ? totalIntakeG / (durationMinutes / 60) : 0;

  await db.query(
    `UPDATE Lunchbox_Meals SET end_time = ?, duration_minutes = ?, total_leftover_g = ?, total_intake_g = ?, updated_at = CURRENT_TIMESTAMP WHERE meal_id = ?`,
    [endTimestamp, durationMinutes, totalLeftoverG, totalIntakeG, mealId]
  );

  if (userId > 0) {
    const mealTime = new Date(startTime * 1000);
    const mealTimeStr = mealTime.toISOString().slice(0, 19).replace('T', ' ');
    const hasLunchboxColumn = await hasColumn('Meal_Records', 'lunchbox_meal_id');
    if (hasLunchboxColumn) {
      await db.query(
        `INSERT INTO Meal_Records (user_id, meal_time, initial_weight, remaining_weight, intake_weight, eating_duration, eating_speed, lunchbox_meal_id, status, is_summarized)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [userId, mealTimeStr, totalServedG, totalLeftoverG, totalIntakeG, durationMinutes * 60, eatingSpeed, mealId]
      );
    } else {
      await db.query(
        `INSERT INTO Meal_Records (user_id, meal_time, initial_weight, remaining_weight, intake_weight, eating_duration, eating_speed, status, is_summarized)
         VALUES (?, ?, ?, ?, ?, ?, ?, 1, 0)`,
        [userId, mealTimeStr, totalServedG, totalLeftoverG, totalIntakeG, durationMinutes * 60, eatingSpeed]
      );
    }
  }

  const s = deviceStates.get(deviceId);
  if (s) {
    s.state = 'IDLE';
    s.last_total_weight = totalLeftoverG;
    s.last_timestamp = endTimestamp;
    s.eating_start_time = undefined;
    s.eating_served_weight = undefined;
    s.current_meal_id = undefined;
    s.stable_since_timestamp = undefined;
  }
}

async function hasColumn(tableName, columnName) {
  try {
    const rows = await db.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tableName, columnName]
    );
    return rows && rows.length > 0;
  } catch (_) {
    return false;
  }
}

/**
 * 处理单条遥测（新 API：weight_g 单值）
 * @param {string} deviceId
 * @param {number} timestampUnix - Unix 秒
 * @param {number} weightG - 当前总重量（克）
 * @returns {Promise<{ previous_state: string, current_state: string, timestamp: string }>} timestamp 为 RFC3339
 */
async function processTelemetry(deviceId, timestampUnix, weightG) {
  const ts = Number(timestampUnix) || 0;
  const w = Number(weightG);
  if (!Number.isFinite(w)) {
    throw new Error('weight_g must be a number');
  }
  const s = getOrInitState(deviceId);
  const previousState = s.state;

  if (s.state === 'IDLE') {
    const deltaW = s.last_timestamp > 0 ? w - s.last_total_weight : 0;
    if (s.last_timestamp > 0 && Math.abs(deltaW) < THRESHOLD.DEADBAND_G) {
      return { previous_state: previousState, current_state: s.state, timestamp: unixToRFC3339(ts) };
    }
    if (s.last_timestamp > 0 && deltaW > THRESHOLD.SERVING_DELTA_G && (ts - s.last_timestamp) <= THRESHOLD.SERVING_TIME_WINDOW_S) {
      s.state = 'SERVING';
      s.serving_start_time = ts;
    }
    s.last_total_weight = w;
    s.last_timestamp = ts;
    return { previous_state: previousState, current_state: s.state, timestamp: unixToRFC3339(ts) };
  }

  if (s.state === 'SERVING') {
    const deltaW = w - s.last_total_weight;
    if (deltaW > 0) {
      s.non_increase_since = undefined;
    } else {
      if (s.non_increase_since == null) s.non_increase_since = ts;
      if ((ts - s.non_increase_since) >= THRESHOLD.EATING_DECREASE_DURATION_S) {
        const userId = await getUserIdByDeviceId(deviceId) || 0;
        const mealId = `meal_${deviceId.replace(/[^a-zA-Z0-9]/g, '_')}_${ts}`;
        await db.query(
          `INSERT INTO Lunchbox_Meals (meal_id, device_id, user_id, start_time, total_served_g) VALUES (?, ?, ?, ?, ?)`,
          [mealId, deviceId, userId, ts, w]
        );
        s.state = 'EATING';
        s.eating_start_time = ts;
        s.eating_served_weight = w;
        s.current_meal_id = mealId;
        s.non_increase_since = undefined;
      }
    }
    s.last_total_weight = w;
    s.last_timestamp = ts;
    return { previous_state: previousState, current_state: s.state, timestamp: unixToRFC3339(ts) };
  }

  if (s.state === 'EATING') {
    if (s.current_meal_id) {
      await db.query(
        `INSERT INTO Meal_Curve_Data (meal_id, timestamp, grid_1, grid_2, grid_3, grid_4) VALUES (?, ?, ?, 0, 0, 0)`,
        [s.current_meal_id, ts, w]
      );
    }

    const deltaW = w - s.last_total_weight;
    if (w < THRESHOLD.SETTLE_WEIGHT_G) {
      await settleMeal(deviceId, s.current_meal_id, w, ts);
      return { previous_state: previousState, current_state: 'IDLE', timestamp: unixToRFC3339(ts) };
    }
    if (Math.abs(deltaW) < THRESHOLD.SETTLE_STABLE_DELTA_G) {
      if (s.stable_since_timestamp == null) s.stable_since_timestamp = ts;
      else if ((ts - s.stable_since_timestamp) >= THRESHOLD.SETTLE_STABLE_DURATION_S) {
        await settleMeal(deviceId, s.current_meal_id, w, ts);
        return { previous_state: previousState, current_state: 'IDLE', timestamp: unixToRFC3339(ts) };
      }
    } else {
      s.stable_since_timestamp = undefined;
    }
    s.last_total_weight = w;
    s.last_timestamp = ts;
    return { previous_state: previousState, current_state: s.state, timestamp: unixToRFC3339(ts) };
  }

  return { previous_state: previousState, current_state: s.state, timestamp: unixToRFC3339(ts) };
}

module.exports = {
  processTelemetry,
  getOrInitState,
  deviceStates,
  THRESHOLD
};

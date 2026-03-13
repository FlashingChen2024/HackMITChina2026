/**
 * 智能餐盒遥测处理与状态机（方案 A Step 3）
 * 按 device_id 维护 IDLE → SERVING → EATING → IDLE，写 Lunchbox_Meals / Meal_Curve_Data，结算时同步 Meal_Records
 * @module services/telemetryService
 */

const db = require('../config/db');
const { getUserIdByDeviceId } = require('./deviceBindingService');

/** 状态机阈值（与规范一致） */
const THRESHOLD = {
  DEADBAND_G: 5,
  SERVING_DELTA_G: 50,
  SERVING_TIME_WINDOW_S: 60,
  EATING_DECREASE_DURATION_S: 15,
  SETTLE_WEIGHT_G: 10,
  SETTLE_STABLE_DELTA_G: 1,
  SETTLE_STABLE_DURATION_S: 600
};

/** 按 device_id 存储状态（内存，重启丢失） */
const deviceStates = new Map();

/**
 * 从 weights 对象计算总重（克）
 * @param {{ grid_1?: number, grid_2?: number, grid_3?: number, grid_4?: number }} weights
 * @returns {number}
 */
function totalWeight(weights) {
  if (!weights || typeof weights !== 'object') return 0;
  const g1 = Number(weights.grid_1) || 0;
  const g2 = Number(weights.grid_2) || 0;
  const g3 = Number(weights.grid_3) || 0;
  const g4 = Number(weights.grid_4) || 0;
  return g1 + g2 + g3 + g4;
}

/**
 * 获取或初始化设备状态
 * @param {string} deviceId
 * @returns {{ state: string, last_total_weight: number, last_timestamp: number, serving_start_time?: number, eating_start_time?: number, eating_served_weight?: number, current_meal_id?: string, stable_since_timestamp?: number, non_increase_since?: number }}
 */
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

/**
 * 结算：更新 Lunchbox_Meals，同步 Meal_Records，重置状态为 IDLE
 * @param {string} deviceId
 * @param {string} mealId
 * @param {number} totalLeftoverG
 * @param {number} endTimestamp
 */
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

/** 检查表是否有某列（用于兼容未执行 007 迁移的情况） */
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
 * 处理单条遥测上报（规范：POST /api/v1/hardware/telemetry body）
 * @param {string} deviceId
 * @param {number} timestamp - Unix 秒
 * @param {{ grid_1?: number, grid_2?: number, grid_3?: number, grid_4?: number }} weights
 */
async function processTelemetry(deviceId, timestamp, weights) {
  if (!deviceId || typeof deviceId !== 'string') return;
  const ts = Number(timestamp) || 0;
  const w = totalWeight(weights || {});
  const s = getOrInitState(deviceId);

  if (s.state === 'IDLE') {
    const deltaW = s.last_timestamp > 0 ? w - s.last_total_weight : 0;
    if (s.last_timestamp > 0 && Math.abs(deltaW) < THRESHOLD.DEADBAND_G) return;
    if (s.last_timestamp > 0 && deltaW > THRESHOLD.SERVING_DELTA_G && (ts - s.last_timestamp) <= THRESHOLD.SERVING_TIME_WINDOW_S) {
      s.state = 'SERVING';
      s.serving_start_time = ts;
    }
    s.last_total_weight = w;
    s.last_timestamp = ts;
    return;
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
    return;
  }

  if (s.state === 'EATING') {
    if (s.current_meal_id) {
      const g1 = Number(weights?.grid_1) ?? 0;
      const g2 = Number(weights?.grid_2) ?? 0;
      const g3 = Number(weights?.grid_3) ?? 0;
      const g4 = Number(weights?.grid_4) ?? 0;
      await db.query(
        `INSERT INTO Meal_Curve_Data (meal_id, timestamp, grid_1, grid_2, grid_3, grid_4) VALUES (?, ?, ?, ?, ?, ?)`,
        [s.current_meal_id, ts, g1, g2, g3, g4]
      );
    }

    const deltaW = w - s.last_total_weight;
    if (w < THRESHOLD.SETTLE_WEIGHT_G) {
      await settleMeal(deviceId, s.current_meal_id, w, ts);
      return;
    }
    if (Math.abs(deltaW) < THRESHOLD.SETTLE_STABLE_DELTA_G) {
      if (s.stable_since_timestamp == null) s.stable_since_timestamp = ts;
      else if ((ts - s.stable_since_timestamp) >= THRESHOLD.SETTLE_STABLE_DURATION_S) {
        await settleMeal(deviceId, s.current_meal_id, w, ts);
        return;
      }
    } else {
      s.stable_since_timestamp = undefined;
    }
    s.last_total_weight = w;
    s.last_timestamp = ts;
  }
}

module.exports = {
  processTelemetry,
  totalWeight,
  getOrInitState,
  deviceStates,
  THRESHOLD
};

/**
 * 智能餐盒用餐记录与轨迹（新 API：items、RFC3339、weight_g 单值）
 * @module services/mealsService
 */

const db = require('../config/db');
const { parseToUnixSeconds, unixToRFC3339 } = require('../utils/time');

const DEFAULT_LIMIT = 20;

/**
 * v4.0 游标分页获取历史用餐列表（可按 userId 过滤，返回 items 含 total_meal_cal）
 * @param {number} [userId] - 不传则不过滤用户
 * @param {string} [cursor]
 * @param {number} [limit]
 * @returns {Promise<{ items: Array<{ meal_id, start_time, duration_minutes, total_meal_cal }>, next_cursor: string }>}
 */
async function listMeals(userId, cursor, limit = DEFAULT_LIMIT) {
  const limitNum = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);
  let cursorUnix = null;
  if (cursor != null && String(cursor).trim() !== '') {
    const parsed = parseToUnixSeconds(cursor);
    if (!parsed.ok) throw new Error(parsed.error);
    cursorUnix = parsed.unix;
  }

  let sql = 'SELECT meal_id, start_time, duration_minutes, total_served_g, total_leftover_g, total_intake_g FROM Lunchbox_Meals WHERE 1=1';
  const params = [];
  if (userId != null && Number.isFinite(Number(userId))) {
    sql += ' AND user_id = ?';
    params.push(Number(userId));
  }
  if (cursorUnix != null) {
    sql += ' AND start_time < ?';
    params.push(cursorUnix);
  }
  sql += ' ORDER BY start_time DESC LIMIT ?';
  params.push(limitNum + 1);

  const rows = await db.query(sql, params);
  const list = Array.isArray(rows) ? rows : [];
  const hasMore = list.length > limitNum;
  const slice = hasMore ? list.slice(0, limitNum) : list;
  const nextCursor = slice.length > 0 ? unixToRFC3339(Number(slice[slice.length - 1].start_time)) : '';

  const items = slice.map((r) => ({
    meal_id: String(r.meal_id),
    start_time: unixToRFC3339(Number(r.start_time)),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : 0,
    total_meal_cal: 0
  }));

  return {
    items,
    next_cursor: hasMore ? nextCursor : ''
  };
}

/**
 * v4.0 获取单次用餐详情（含 grid_details 占位，total_meal_cal）
 * @param {string} mealId
 * @returns {Promise<{ meal_id, start_time, duration_minutes, total_meal_cal, grid_details } | null>}
 */
async function getMealDetail(mealId) {
  const rows = await db.query(
    'SELECT meal_id, start_time, duration_minutes, total_served_g, total_leftover_g, total_intake_g FROM Lunchbox_Meals WHERE meal_id = ? LIMIT 1',
    [mealId]
  );
  const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!r) return null;
  const served = Number(r.total_served_g) || 0, left = Number(r.total_leftover_g) ?? 0, intake = Number(r.total_intake_g) ?? (served - left);
  const durationMin = r.duration_minutes != null ? Number(r.duration_minutes) : 0;
  const speed = durationMin > 0 ? intake / durationMin : 0;
  const grid_details = [
    { grid_index: 1, food_name: '', served_g: served / 4, leftover_g: left / 4, intake_g: intake / 4, total_cal: 0, speed_g_per_min: speed / 4 },
    { grid_index: 2, food_name: '', served_g: served / 4, leftover_g: left / 4, intake_g: intake / 4, total_cal: 0, speed_g_per_min: speed / 4 },
    { grid_index: 3, food_name: '', served_g: served / 4, leftover_g: left / 4, intake_g: intake / 4, total_cal: 0, speed_g_per_min: speed / 4 },
    { grid_index: 4, food_name: '', served_g: served / 4, leftover_g: left / 4, intake_g: intake / 4, total_cal: 0, speed_g_per_min: speed / 4 }
  ];
  return {
    meal_id: String(r.meal_id),
    start_time: unixToRFC3339(Number(r.start_time)),
    duration_minutes: durationMin,
    total_meal_cal: 0,
    grid_details
  };
}

/**
 * v4.0 获取就餐时序轨迹（items 含 weights { grid_1..4 }）
 */
function toWeights(r) {
  return {
    timestamp: unixToRFC3339(Number(r.timestamp)),
    weights: {
      grid_1: Number(r.grid_1) ?? 0,
      grid_2: Number(r.grid_2) ?? 0,
      grid_3: Number(r.grid_3) ?? 0,
      grid_4: Number(r.grid_4) ?? 0
    }
  };
}

async function getMealTrajectory(mealId, lastTimestamp, sampleInterval) {
  const isIncremental = lastTimestamp != null && String(lastTimestamp).trim() !== '';
  let tsUnix = null;
  if (isIncremental) {
    const parsed = parseToUnixSeconds(lastTimestamp);
    if (!parsed.ok) throw new Error(parsed.error);
    tsUnix = parsed.unix;
  }
  const interval = sampleInterval != null && sampleInterval !== '' ? Math.max(1, Number(sampleInterval)) : null;

  let items = [];
  if (interval != null && interval > 0 && !isIncremental) {
    const rows = await db.query(
      `SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? ORDER BY timestamp ASC`,
      [mealId]
    );
    const raw = Array.isArray(rows) ? rows : [];
    const bucket = new Map();
    for (const r of raw) {
      const t = Number(r.timestamp);
      const key = Math.floor(t / interval) * interval;
      if (!bucket.has(key)) bucket.set(key, { g1: 0, g2: 0, g3: 0, g4: 0, n: 0 });
      const b = bucket.get(key);
      b.g1 += Number(r.grid_1) || 0; b.g2 += Number(r.grid_2) || 0; b.g3 += Number(r.grid_3) || 0; b.g4 += Number(r.grid_4) || 0;
      b.n += 1;
    }
    items = Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({
        timestamp: unixToRFC3339(t),
        weights: {
          grid_1: v.n ? v.g1 / v.n : 0,
          grid_2: v.n ? v.g2 / v.n : 0,
          grid_3: v.n ? v.g3 / v.n : 0,
          grid_4: v.n ? v.g4 / v.n : 0
        }
      }));
  } else if (isIncremental) {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? AND timestamp > ? ORDER BY timestamp ASC',
      [mealId, tsUnix]
    );
    items = (Array.isArray(rows) ? rows : []).map(toWeights);
  } else {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? ORDER BY timestamp ASC',
      [mealId]
    );
    items = (Array.isArray(rows) ? rows : []).map(toWeights);
  }

  return {
    meal_id: String(mealId),
    items,
    last_timestamp: items.length > 0 ? items[items.length - 1].timestamp : ''
  };
}

module.exports = {
  listMeals,
  getMealDetail,
  getMealTrajectory
};

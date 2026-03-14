/**
 * 智能餐盒用餐记录与轨迹（新 API：items、RFC3339、weight_g 单值）
 * @module services/mealsService
 */

const db = require('../config/db');
const { parseToUnixSeconds, unixToRFC3339 } = require('../utils/time');

const DEFAULT_LIMIT = 20;

/**
 * 游标分页获取历史用餐列表（新 API：仅 cursor，返回 items + next_cursor）
 * @param {string} [cursor] - RFC3339 或 Unix 秒字符串，不传则首页
 * @param {number} [limit]
 * @returns {Promise<{ items: Array<{ meal_id, user_id, start_time, duration_minutes, total_served_g, total_leftover_g }>, next_cursor: string }>}
 */
async function listMeals(cursor, limit = DEFAULT_LIMIT) {
  const limitNum = Math.min(Math.max(Number(limit) || DEFAULT_LIMIT, 1), 100);
  let cursorUnix = null;
  if (cursor != null && String(cursor).trim() !== '') {
    const parsed = parseToUnixSeconds(cursor);
    if (!parsed.ok) throw new Error(parsed.error);
    cursorUnix = parsed.unix;
  }

  let sql = 'SELECT meal_id, user_id, start_time, duration_minutes, total_served_g, total_leftover_g FROM Lunchbox_Meals WHERE 1=1';
  const params = [];
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
    user_id: String(r.user_id),
    start_time: unixToRFC3339(Number(r.start_time)),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : 0,
    total_served_g: Number(r.total_served_g) || 0,
    total_leftover_g: Number(r.total_leftover_g) ?? 0
  }));

  return {
    items,
    next_cursor: hasMore ? nextCursor : ''
  };
}

/**
 * 获取单次用餐详情（新 API：user_id、start_time RFC3339）
 * @param {string} mealId
 * @returns {Promise<{ meal_id, user_id, start_time, duration_minutes, total_served_g, total_leftover_g } | null>}
 */
async function getMealDetail(mealId) {
  const rows = await db.query(
    'SELECT meal_id, user_id, start_time, duration_minutes, total_served_g, total_leftover_g FROM Lunchbox_Meals WHERE meal_id = ? LIMIT 1',
    [mealId]
  );
  const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!r) return null;
  return {
    meal_id: String(r.meal_id),
    user_id: String(r.user_id),
    start_time: unixToRFC3339(Number(r.start_time)),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : 0,
    total_served_g: Number(r.total_served_g) || 0,
    total_leftover_g: Number(r.total_leftover_g) ?? 0
  };
}

/**
 * 获取就餐时序轨迹（新 API：items[{ timestamp, weight_g }], last_timestamp）
 * @param {string} mealId
 * @param {string} [lastTimestamp] - RFC3339 或 Unix 秒字符串，增量游标
 * @param {number} [sampleInterval] - 降采样间隔（秒）
 * @returns {Promise<{ meal_id, items: Array<{ timestamp, weight_g }>, last_timestamp: string }>}
 */
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
      const w = (Number(r.grid_1) || 0) + (Number(r.grid_2) || 0) + (Number(r.grid_3) || 0) + (Number(r.grid_4) || 0);
      if (!bucket.has(key)) bucket.set(key, { sum: 0, n: 0 });
      const b = bucket.get(key);
      b.sum += w;
      b.n += 1;
    }
    items = Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([t, v]) => ({
        timestamp: unixToRFC3339(t),
        weight_g: v.n ? Math.round(v.sum / v.n) : 0
      }));
  } else if (isIncremental) {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? AND timestamp > ? ORDER BY timestamp ASC',
      [mealId, tsUnix]
    );
    const raw = Array.isArray(rows) ? rows : [];
    items = raw.map((r) => {
      const t = Number(r.timestamp);
      const w = (Number(r.grid_1) || 0) + (Number(r.grid_2) || 0) + (Number(r.grid_3) || 0) + (Number(r.grid_4) || 0);
      return { timestamp: unixToRFC3339(t), weight_g: Math.round(w) };
    });
  } else {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? ORDER BY timestamp ASC',
      [mealId]
    );
    const raw = Array.isArray(rows) ? rows : [];
    items = raw.map((r) => {
      const t = Number(r.timestamp);
      const w = (Number(r.grid_1) || 0) + (Number(r.grid_2) || 0) + (Number(r.grid_3) || 0) + (Number(r.grid_4) || 0);
      return { timestamp: unixToRFC3339(t), weight_g: Math.round(w) };
    });
  }

  const lastTimestampStr = items.length > 0 ? items[items.length - 1].timestamp : '';

  return {
    meal_id: String(mealId),
    items,
    last_timestamp: lastTimestampStr
  };
}

module.exports = {
  listMeals,
  getMealDetail,
  getMealTrajectory
};

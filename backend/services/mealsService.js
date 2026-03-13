/**
 * 智能餐盒用餐记录与轨迹（规范：GET /meals、GET /meals/:meal_id、GET /meals/:meal_id/trajectory）
 * @module services/mealsService
 */

const db = require('../config/db');

/**
 * 游标分页获取用户历史用餐列表
 * @param {number} userId - 用户 ID
 * @param {number} [cursor] - 上一页最后一条的 start_time（不传则首页）
 * @param {number} [limit=20] - 每页条数
 * @returns {Promise<{ data: Array<{ meal_id: string, start_time: number, total_served_g: number }>, pagination: { next_cursor: number|null, has_more: boolean } }>}
 */
async function listMeals(userId, cursor, limit = 20) {
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);
  let sql = 'SELECT meal_id, start_time, total_served_g FROM Lunchbox_Meals WHERE user_id = ?';
  const params = [userId];
  if (cursor != null && cursor !== '') {
    sql += ' AND start_time < ?';
    params.push(Number(cursor));
  }
  sql += ' ORDER BY start_time DESC LIMIT ?';
  params.push(limitNum + 1);

  const rows = await db.query(sql, params);
  const list = Array.isArray(rows) ? rows : [];
  const hasMore = list.length > limitNum;
  const slice = hasMore ? list.slice(0, limitNum) : list;
  const nextCursor = slice.length > 0 ? Number(slice[slice.length - 1].start_time) : null;

  const data = slice.map((r) => ({
    meal_id: String(r.meal_id),
    start_time: Number(r.start_time),
    total_served_g: Number(r.total_served_g) || 0
  }));

  return {
    data,
    pagination: {
      next_cursor: hasMore ? nextCursor : null,
      has_more: hasMore
    }
  };
}

/**
 * 获取单次用餐详情（O(1) 主键读取）
 * @param {string} mealId
 * @returns {Promise<{ meal_id: string, duration_minutes: number, total_served_g: number, total_leftover_g: number, total_intake_g: number } | null>}
 */
async function getMealDetail(mealId) {
  const rows = await db.query(
    'SELECT meal_id, duration_minutes, total_served_g, total_leftover_g, total_intake_g FROM Lunchbox_Meals WHERE meal_id = ? LIMIT 1',
    [mealId]
  );
  const r = Array.isArray(rows) && rows[0] ? rows[0] : null;
  if (!r) return null;
  return {
    meal_id: String(r.meal_id),
    duration_minutes: r.duration_minutes != null ? Number(r.duration_minutes) : 0,
    total_served_g: Number(r.total_served_g) || 0,
    total_leftover_g: Number(r.total_leftover_g) ?? 0,
    total_intake_g: Number(r.total_intake_g) ?? 0
  };
}

/**
 * 获取就餐时序轨迹（全量或增量，可选降采样）
 * @param {string} mealId
 * @param {number} [lastTimestamp] - 增量游标，不传则全量
 * @param {number} [sampleInterval] - 降采样间隔（秒）
 * @returns {Promise<{ meal_id: string, query_mode: 'historical'|'incremental', points: Array<{ timestamp: number, weights: object }> }>}
 */
async function getMealTrajectory(mealId, lastTimestamp, sampleInterval) {
  const isIncremental = lastTimestamp != null && lastTimestamp !== '';
  const queryMode = isIncremental ? 'incremental' : 'historical';
  const ts = isIncremental ? Number(lastTimestamp) : null;
  const interval = sampleInterval != null && sampleInterval !== '' ? Math.max(1, Number(sampleInterval)) : null;

  let points = [];
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
      if (!bucket.has(key)) {
        bucket.set(key, { sum: { g1: 0, g2: 0, g3: 0, g4: 0 }, n: 0 });
      }
      const b = bucket.get(key);
      b.sum.g1 += Number(r.grid_1) || 0;
      b.sum.g2 += Number(r.grid_2) || 0;
      b.sum.g3 += Number(r.grid_3) || 0;
      b.sum.g4 += Number(r.grid_4) || 0;
      b.n += 1;
    }
    points = Array.from(bucket.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([timestamp, v]) => ({
        timestamp,
        weights: {
          grid_1: v.n ? v.sum.g1 / v.n : 0,
          grid_2: v.n ? v.sum.g2 / v.n : 0,
          grid_3: v.n ? v.sum.g3 / v.n : 0,
          grid_4: v.n ? v.sum.g4 / v.n : 0
        }
      }));
  } else if (isIncremental) {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? AND timestamp > ? ORDER BY timestamp ASC',
      [mealId, ts]
    );
    const raw = Array.isArray(rows) ? rows : [];
    points = raw.map((r) => ({
      timestamp: Number(r.timestamp),
      weights: {
        grid_1: Number(r.grid_1) ?? 0,
        grid_2: Number(r.grid_2) ?? 0,
        grid_3: Number(r.grid_3) ?? 0,
        grid_4: Number(r.grid_4) ?? 0
      }
    }));
  } else {
    const rows = await db.query(
      'SELECT timestamp, grid_1, grid_2, grid_3, grid_4 FROM Meal_Curve_Data WHERE meal_id = ? ORDER BY timestamp ASC',
      [mealId]
    );
    const raw = Array.isArray(rows) ? rows : [];
    points = raw.map((r) => ({
      timestamp: Number(r.timestamp),
      weights: {
        grid_1: Number(r.grid_1) ?? 0,
        grid_2: Number(r.grid_2) ?? 0,
        grid_3: Number(r.grid_3) ?? 0,
        grid_4: Number(r.grid_4) ?? 0
      }
    }));
  }

  return {
    meal_id: String(mealId),
    query_mode: queryMode,
    points
  };
}

module.exports = {
  listMeals,
  getMealDetail,
  getMealTrajectory
};

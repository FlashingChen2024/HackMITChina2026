/**
 * Mock 数据种子服务：批量写入用餐记录，便于图表/日报有数据
 * @module services/seedService
 */

const db = require('../config/db');

/**
 * 将单条记录转为 meal_time 字符串（支持 ISO 或 YYYY-MM-DD HH:mm:ss）
 * @param {string} mealTime
 * @returns {string}
 */
function normalizeMealTime(mealTime) {
  if (!mealTime) return null;
  const s = String(mealTime).trim();
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * 批量插入用餐记录（Mock 数据）
 * @param {Array<{ user_id?: number, meal_time: string, initial_weight?: number, remaining_weight?: number, intake_weight?: number, eating_duration?: number, eating_speed?: number, total_calories?: number }>} records
 * @param {number} [currentUserId] - 未传 user_id 时使用的用户 ID（如鉴权后的当前用户）
 * @returns {Promise<{ inserted: number }>}
 */
async function insertMealRecords(records, currentUserId) {
  if (!Array.isArray(records) || records.length === 0) {
    return { inserted: 0 };
  }
  const hasLunchboxColumn = await hasColumn('Meal_Records', 'lunchbox_meal_id');
  const sql = hasLunchboxColumn
    ? `INSERT INTO Meal_Records (user_id, meal_time, initial_weight, remaining_weight, intake_weight, eating_duration, eating_speed, total_calories, status, is_summarized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`
    : `INSERT INTO Meal_Records (user_id, meal_time, initial_weight, remaining_weight, intake_weight, eating_duration, eating_speed, total_calories, status, is_summarized)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0)`;

  let inserted = 0;
  for (const r of records) {
    let userId = Number(r.user_id);
    if (!Number.isFinite(userId) || userId < 1) userId = Number(currentUserId) || 1;
    const mealTime = normalizeMealTime(r.meal_time);
    if (!mealTime) continue;
    const initial = Number(r.initial_weight) ?? 0;
    const remaining = Number(r.remaining_weight) ?? 0;
    const intake = Number(r.intake_weight) ?? (initial - remaining);
    const duration = r.eating_duration != null ? Number(r.eating_duration) : null;
    const speed = r.eating_speed != null ? Number(r.eating_speed) : null;
    const calories = r.total_calories != null ? Number(r.total_calories) : null;
    await db.query(sql, [userId, mealTime, initial, remaining, intake, duration, speed, calories]);
    inserted += 1;
  }
  return { inserted };
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

module.exports = {
  insertMealRecords
};

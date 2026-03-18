/**
 * 每日饮食数据汇总服务
 * 从 Meal_Records 汇总到 Daily_Diet_Summary，并标记已汇总
 * @module services/dietSummaryService
 */

const db = require('../config/db');

/**
 * 获取指定日期有未汇总记录的用户 ID 列表
 * @param {string} date - 日期 YYYY-MM-DD
 * @returns {Promise<Array<{ user_id: number }>>}
 */
async function getUsersWithUnsummarizedRecords(date) {
  const sql = `
    SELECT DISTINCT user_id
    FROM Meal_Records
    WHERE DATE(meal_time) = ?
      AND is_summarized = 0
    ORDER BY user_id
  `;
  const rows = await db.query(sql, [date]);
  return rows;
}

/**
 * 汇总指定用户指定日期的饮食数据并写入 Daily_Diet_Summary，并标记原记录已汇总
 * @param {number} userId - 用户 ID
 * @param {string} date - 日期 YYYY-MM-DD
 * @returns {Promise<object|null>} 汇总结果对象，无记录时返回 null
 */
async function summarizeDailyDiet(userId, date) {
  const dateStart = `${date} 00:00:00`;
  const dateEnd = `${date} 23:59:59`;

  const listSql = `
    SELECT id, initial_weight, remaining_weight, intake_weight,
           eating_duration, eating_speed, total_calories
    FROM Meal_Records
    WHERE user_id = ? AND meal_time >= ? AND meal_time <= ? AND is_summarized = 0
    ORDER BY meal_time
  `;
  const records = await db.query(listSql, [userId, dateStart, dateEnd]);

  if (!records || records.length === 0) {
    return null;
  }

  let totalInitialWeight = 0;
  let totalRemainingWeight = 0;
  let totalIntakeWeight = 0;
  let totalCalories = 0;
  let fastestMealDuration = null;
  let slowestMealDuration = null;
  let totalSpeed = 0;
  let speedCount = 0;
  const ids = [];

  for (const r of records) {
    totalInitialWeight += Number(r.initial_weight) || 0;
    totalRemainingWeight += Number(r.remaining_weight) || 0;
    totalIntakeWeight += Number(r.intake_weight) || 0;
    totalCalories += Number(r.total_calories) || 0;
    ids.push(r.id);

    const duration = r.eating_duration != null ? Number(r.eating_duration) : null;
    if (duration != null) {
      if (fastestMealDuration == null || duration < fastestMealDuration) {
        fastestMealDuration = duration;
      }
      if (slowestMealDuration == null || duration > slowestMealDuration) {
        slowestMealDuration = duration;
      }
    }
    if (r.eating_speed != null) {
      totalSpeed += Number(r.eating_speed);
      speedCount += 1;
    }
  }

  const avgEatingSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;

  const upsertSql = `
    INSERT INTO Daily_Diet_Summary (
      user_id, date,
      total_initial_weight, total_remaining_weight, total_intake_weight,
      total_calories, avg_eating_speed,
      meal_count, fastest_meal_duration, slowest_meal_duration
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE
      total_initial_weight = VALUES(total_initial_weight),
      total_remaining_weight = VALUES(total_remaining_weight),
      total_intake_weight = VALUES(total_intake_weight),
      total_calories = VALUES(total_calories),
      avg_eating_speed = VALUES(avg_eating_speed),
      meal_count = VALUES(meal_count),
      fastest_meal_duration = VALUES(fastest_meal_duration),
      slowest_meal_duration = VALUES(slowest_meal_duration),
      updated_at = CURRENT_TIMESTAMP
  `;
  await db.query(upsertSql, [
    userId,
    date,
    totalInitialWeight,
    totalRemainingWeight,
    totalIntakeWeight,
    totalCalories,
    avgEatingSpeed,
    records.length,
    fastestMealDuration,
    slowestMealDuration
  ]);

  if (ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    await db.query(
      `UPDATE Meal_Records SET is_summarized = 1 WHERE id IN (${placeholders})`,
      ids
    );
  }

  return {
    user_id: userId,
    date,
    total_initial_weight: totalInitialWeight,
    total_remaining_weight: totalRemainingWeight,
    total_intake_weight: totalIntakeWeight,
    total_calories: totalCalories,
    avg_eating_speed: avgEatingSpeed,
    meal_count: records.length,
    fastest_meal_duration: fastestMealDuration,
    slowest_meal_duration: slowestMealDuration
  };
}

/**
 * 执行指定日期的全量汇总（供定时任务或手动触发）
 * @param {string} [date] - 日期 YYYY-MM-DD，不传则汇总昨天
 * @returns {Promise<{ date: string, userCount: number, error?: string }>}
 */
async function runDailySummary(date) {
  const targetDate = date || (() => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  const users = await getUsersWithUnsummarizedRecords(targetDate);
  let processed = 0;
  for (const u of users) {
    try {
      await summarizeDailyDiet(u.user_id, targetDate);
      processed += 1;
    } catch (err) {
      console.error(`[dietSummary] user ${u.user_id} date ${targetDate} failed:`, err.message);
    }
  }
  return { date: targetDate, userCount: processed };
}

/**
 * 对日期范围内每一天执行汇总（便于服务器上大量 Meal_Records 一次性进入图表）
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<{ days: number, totalUserDays: number }>}
 */
async function runSummaryDateRange(startDate, endDate) {
  if (!startDate || !endDate || startDate > endDate) {
    throw new Error('start_date 与 end_date 必填且 start_date 不能大于 end_date');
  }
  let days = 0;
  let totalUserDays = 0;
  let d = startDate;
  while (d <= endDate) {
    const r = await runDailySummary(d);
    if (r && r.userCount > 0) totalUserDays += r.userCount;
    days += 1;
    const next = new Date(d + 'T12:00:00Z');
    next.setUTCDate(next.getUTCDate() + 1);
    d = next.toISOString().slice(0, 10);
  }
  return { days, totalUserDays };
}

module.exports = {
  getUsersWithUnsummarizedRecords,
  summarizeDailyDiet,
  runDailySummary,
  runSummaryDateRange
};

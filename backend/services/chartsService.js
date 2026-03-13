/**
 * 阶段二：统计图表数据服务
 * 从 Daily_Diet_Summary 聚合，供 GET /api/diet/statistics/charts 使用
 * @module services/chartsService
 */

const db = require('../config/db');

/**
 * 获取用户指定日期范围内的日汇总（按日期升序）
 * @param {number} userId
 * @param {string} startDate - YYYY-MM-DD
 * @param {string} endDate - YYYY-MM-DD
 * @returns {Promise<Array<{ date: string, total_initial_weight, total_remaining_weight, total_intake_weight, total_calories, avg_eating_speed, ... }>>}
 */
async function getSummaryRange(userId, startDate, endDate) {
  const rows = await db.query(
    `SELECT date, total_initial_weight, total_remaining_weight, total_intake_weight,
            total_calories, avg_eating_speed, meal_count
     FROM Daily_Diet_Summary
     WHERE user_id = ? AND date >= ? AND date <= ?
     ORDER BY date ASC`,
    [userId, startDate, endDate]
  );
  return rows || [];
}

/**
 * 计算趋势：increasing / decreasing / stable（基于摄入量）
 * @param {Array<{ total_intake_weight: number }>} rows
 * @returns {string}
 */
function computeTrend(rows) {
  if (!rows || rows.length < 2) return 'stable';
  const first = Number(rows[0].total_intake_weight) || 0;
  const last = Number(rows[rows.length - 1].total_intake_weight) || 0;
  if (first === 0) return 'stable';
  const change = ((last - first) / first) * 100;
  if (change > 10) return 'increasing';
  if (change < -10) return 'decreasing';
  return 'stable';
}

/**
 * 日趋势图：dates + 打饭量/摄入量/剩余量 + summary
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 * @returns {Promise<{ chart_type: string, dates: string[], series: Array<{ name: string, data: number[], unit: string }>, summary: object }>}
 */
async function getDailyTrend(userId, startDate, endDate) {
  const rows = await getSummaryRange(userId, startDate, endDate);
  const dates = rows.map(r => String(r.date).slice(0, 10));
  const series = [
    { name: '打饭量', data: rows.map(r => Number(r.total_initial_weight) || 0), unit: 'g' },
    { name: '摄入量', data: rows.map(r => Number(r.total_intake_weight) || 0), unit: 'g' },
    { name: '剩余量', data: rows.map(r => Number(r.total_remaining_weight) || 0), unit: 'g' }
  ];
  let avgIntake = 0;
  let totalInitial = 0;
  let totalRemaining = 0;
  if (rows.length > 0) {
    rows.forEach(r => {
      avgIntake += Number(r.total_intake_weight) || 0;
      totalInitial += Number(r.total_initial_weight) || 0;
      totalRemaining += Number(r.total_remaining_weight) || 0;
    });
    avgIntake /= rows.length;
  }
  const avgWasteRate = totalInitial > 0 ? (totalRemaining / totalInitial) * 100 : 0;
  return {
    chart_type: 'daily_trend',
    dates,
    series,
    summary: {
      avg_intake: Math.round(avgIntake * 10) / 10,
      avg_waste_rate: Math.round(avgWasteRate * 10) / 10,
      trend: computeTrend(rows)
    }
  };
}

/**
 * 浪费率分析图：dates + 浪费率(%)
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 */
async function getWasteAnalysis(userId, startDate, endDate) {
  const rows = await getSummaryRange(userId, startDate, endDate);
  const dates = rows.map(r => String(r.date).slice(0, 10));
  const wasteRates = rows.map(r => {
    const init = Number(r.total_initial_weight) || 0;
    const remain = Number(r.total_remaining_weight) || 0;
    return init > 0 ? Math.round((remain / init) * 1000) / 10 : 0;
  });
  let avgWaste = 0;
  let totalInit = 0;
  let totalRem = 0;
  rows.forEach(r => {
    totalInit += Number(r.total_initial_weight) || 0;
    totalRem += Number(r.total_remaining_weight) || 0;
  });
  avgWaste = totalInit > 0 ? (totalRem / totalInit) * 100 : 0;
  return {
    chart_type: 'waste_analysis',
    dates,
    series: [{ name: '浪费率', data: wasteRates, unit: '%' }],
    summary: { avg_waste_rate: Math.round(avgWaste * 10) / 10, trend: computeTrend(rows) }
  };
}

/**
 * 用餐速度分析图：dates + 平均用餐速度(g/min)
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 */
async function getSpeedAnalysis(userId, startDate, endDate) {
  const rows = await getSummaryRange(userId, startDate, endDate);
  const dates = rows.map(r => String(r.date).slice(0, 10));
  const speeds = rows.map(r => Math.round((Number(r.avg_eating_speed) || 0) * 10) / 10);
  let avgSpeed = 0;
  let count = 0;
  speeds.forEach(s => { avgSpeed += s; count += 1; });
  avgSpeed = count > 0 ? Math.round((avgSpeed / count) * 10) / 10 : 0;
  return {
    chart_type: 'speed_analysis',
    dates,
    series: [{ name: '平均用餐速度', data: speeds, unit: 'g/min' }],
    summary: { avg_speed: avgSpeed, trend: computeTrend(rows) }
  };
}

/**
 * 周对比图：本周 vs 上周（取 end_date 前 14 天，前 7 天=上周，后 7 天=本周）
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 */
async function getWeeklyComparison(userId, startDate, endDate) {
  const rows = await getSummaryRange(userId, startDate, endDate);
  const n = rows.length;
  const mid = Math.floor(n / 2);
  const lastWeekRows = mid > 0 ? rows.slice(0, mid) : [];
  const thisWeekRows = mid < n ? rows.slice(mid) : rows;
  const lastWeekDates = lastWeekRows.map(r => String(r.date).slice(0, 10));
  const thisWeekDates = thisWeekRows.map(r => String(r.date).slice(0, 10));
  const dates = thisWeekDates.length >= lastWeekDates.length ? thisWeekDates : lastWeekDates;
  const lastWeekIntake = lastWeekRows.map(r => Number(r.total_intake_weight) || 0);
  const thisWeekIntake = thisWeekRows.map(r => Number(r.total_intake_weight) || 0);
  const series = [
    { name: '本周', data: thisWeekIntake, unit: 'g' },
    { name: '上周', data: lastWeekIntake, unit: 'g' }
  ];
  let avgThis = 0, avgLast = 0;
  if (thisWeekIntake.length) avgThis = thisWeekIntake.reduce((a, b) => a + b, 0) / thisWeekIntake.length;
  if (lastWeekIntake.length) avgLast = lastWeekIntake.reduce((a, b) => a + b, 0) / lastWeekIntake.length;
  const intakeChange = avgLast > 0 ? Math.round(((avgThis - avgLast) / avgLast) * 1000) / 10 : 0;
  return {
    chart_type: 'weekly_comparison',
    dates,
    series,
    summary: { avg_this_week: Math.round(avgThis * 10) / 10, avg_last_week: Math.round(avgLast * 10) / 10, intake_change_pct: intakeChange }
  };
}

/**
 * 营养摄入饼图（简化）：日期范围内各日卡路里占比，或「总卡路里」单条
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 */
async function getNutritionPie(userId, startDate, endDate) {
  const rows = await getSummaryRange(userId, startDate, endDate);
  const totalCal = rows.reduce((sum, r) => sum + (Number(r.total_calories) || 0), 0);
  if (totalCal <= 0) {
    return {
      chart_type: 'nutrition_pie',
      dates: [],
      series: [{ name: '总卡路里', data: [0], unit: 'kcal' }],
      summary: { total_calories: 0 }
    };
  }
  const categories = rows.map(r => String(r.date).slice(0, 10));
  const values = rows.map(r => Math.round((Number(r.total_calories) || 0) * 10) / 10);
  const series = categories.map((d, i) => ({ name: d, value: values[i] }));
  if (series.length === 0) series.push({ name: '总卡路里', value: Math.round(totalCal * 10) / 10 });
  return {
    chart_type: 'nutrition_pie',
    dates: categories,
    series,
    summary: { total_calories: Math.round(totalCal * 10) / 10 }
  };
}

/** 支持的图表类型 */
const CHART_TYPES = ['daily_trend', 'weekly_comparison', 'waste_analysis', 'speed_analysis', 'nutrition_pie'];

/**
 * 根据 chart_type 返回对应图表数据
 * @param {number} userId
 * @param {string} startDate
 * @param {string} endDate
 * @param {string} chartType
 * @returns {Promise<object>}
 */
async function getChartData(userId, startDate, endDate, chartType) {
  if (!CHART_TYPES.includes(chartType)) {
    throw new Error(`不支持的 chart_type: ${chartType}，可选: ${CHART_TYPES.join(', ')}`);
  }
  switch (chartType) {
    case 'daily_trend':
      return getDailyTrend(userId, startDate, endDate);
    case 'weekly_comparison':
      return getWeeklyComparison(userId, startDate, endDate);
    case 'waste_analysis':
      return getWasteAnalysis(userId, startDate, endDate);
    case 'speed_analysis':
      return getSpeedAnalysis(userId, startDate, endDate);
    case 'nutrition_pie':
      return getNutritionPie(userId, startDate, endDate);
    default:
      throw new Error(`不支持的 chart_type: ${chartType}`);
  }
}

module.exports = {
  getSummaryRange,
  getChartData,
  getDailyTrend,
  getWeeklyComparison,
  getWasteAnalysis,
  getSpeedAnalysis,
  getNutritionPie,
  CHART_TYPES
};

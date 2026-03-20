/**
 * AI 饮食分析服务：数据获取、AI 调用、结果解析与存储、降级报告
 * 模块5 阶段三 5-3-3
 * @module services/aiAnalysisService
 */

const db = require('../config/db');
const { generatePrompt } = require('./promptService');
const { diagnoseDietIssues, formatDiagnosisForPrompt, calcWasteRate } = require('./diagnosisService');

const REPORT_TYPE_DAILY = 1;
const REPORT_TYPE_WEEKLY = 2;
const REPORT_TYPE_MONTHLY = 3;
const MODEL_VERSION = 'gpt-4o-mini';
const PROMPT_VERSION = '1.0';

/**
 * 获取指定用户指定日期的日汇总数据
 * @param {number} userId
 * @param {string} date - YYYY-MM-DD
 * @returns {Promise<object|null>}
 */
async function getDailySummary(userId, date) {
  const rows = await db.query(
    'SELECT * FROM Daily_Diet_Summary WHERE user_id = ? AND date = ? LIMIT 1',
    [userId, date]
  );
  return rows && rows[0] ? rows[0] : null;
}

/**
 * 获取用户近期历史汇总的统计（用于趋势与均值）
 * @param {number} userId
 * @param {string} endDate - YYYY-MM-DD，统计该日期之前的 N 天
 * @param {number} days - 天数，默认 7
 * @returns {Promise<{ avg_daily_intake: number, avg_daily_remaining_weight: number, avg_waste_rate: number, avg_eating_speed: number, trend: string, rows: Array }>}
 */
async function getHistoricalData(userId, endDate, days = 7) {
  const rows = await db.query(
    `SELECT * FROM Daily_Diet_Summary
     WHERE user_id = ? AND date <= ? AND date > DATE_SUB(?, INTERVAL ? DAY)
     ORDER BY date DESC
     LIMIT ?`,
    [userId, endDate, endDate, days, days]
  );

  if (!rows || rows.length === 0) {
    return {
      avg_daily_intake: 0,
      avg_daily_remaining_weight: 0,
      avg_waste_rate: 0,
      avg_eating_speed: 0,
      trend: '数据不足',
      rows: []
    };
  }

  let sumIntake = 0;
  let sumRemaining = 0;
  let sumInitial = 0;
  let sumSpeed = 0;
  let speedCount = 0;
  for (const r of rows) {
    sumIntake += Number(r.total_intake_weight) || 0;
    sumRemaining += Number(r.total_remaining_weight) || 0;
    sumInitial += Number(r.total_initial_weight) || 0;
    if (r.avg_eating_speed != null) {
      sumSpeed += Number(r.avg_eating_speed);
      speedCount++;
    }
  }
  const n = rows.length;
  const avg_daily_intake = n ? sumIntake / n : 0;
  const avg_daily_remaining_weight = n ? sumRemaining / n : 0;
  const avg_waste_rate = sumInitial > 0 ? (sumRemaining / sumInitial) * 100 : 0;
  const avg_eating_speed = speedCount > 0 ? sumSpeed / speedCount : 0;

  let trend = '稳定';
  if (rows.length >= 2) {
    const recent = Number(rows[0].total_intake_weight) || 0;
    const older = Number(rows[rows.length - 1].total_intake_weight) || 0;
    if (older > 0) {
      const change = ((recent - older) / older) * 100;
      if (change > 10) trend = '上升';
      else if (change < -10) trend = '下降';
    }
  }

  return {
    avg_daily_intake,
    avg_daily_remaining_weight,
    avg_waste_rate,
    avg_eating_speed,
    trend,
    rows
  };
}

/**
 * 获取用户一周汇总数据（用于周报）
 * @param {number} userId
 * @param {string} endDate - 周结束日期 YYYY-MM-DD（含该日，共 7 天）
 * @returns {Promise<{ startDate: string, endDate: string, avg_daily_initial_weight: number, avg_daily_intake: number, avg_daily_remaining_weight: number, avg_waste_rate: number, avg_daily_calories: number, avg_eating_speed: number, intake_trend: string, waste_trend: string, speed_trend: string, intake_change: string, waste_change: string, speed_change: string, rows: Array }>}
 */
async function getWeeklySummaryData(userId, endDate) {
  const thisWeekRows = await db.query(
    `SELECT * FROM Daily_Diet_Summary
     WHERE user_id = ? AND date <= ? AND date > DATE_SUB(?, INTERVAL 7 DAY)
     ORDER BY date ASC`,
    [userId, endDate, endDate]
  );
  const startDate = thisWeekRows && thisWeekRows.length > 0
    ? thisWeekRows[0].date
    : endDate;

  function aggregate(rows) {
    if (!rows || rows.length === 0) {
      return { avg_initial: 0, avg_intake: 0, avg_remaining: 0, waste_rate: 0, avg_calories: 0, avg_speed: 0, trend: '数据不足' };
    }
    let si = 0, sr = 0, sInit = 0, sCal = 0, sSp = 0, nSp = 0;
    for (const r of rows) {
      si += Number(r.total_intake_weight) || 0;
      sr += Number(r.total_remaining_weight) || 0;
      sInit += Number(r.total_initial_weight) || 0;
      sCal += Number(r.total_calories) || 0;
      if (r.avg_eating_speed != null) { sSp += Number(r.avg_eating_speed); nSp++; }
    }
    const n = rows.length;
    const waste_rate = sInit > 0 ? (sr / sInit) * 100 : 0;
    let trend = '稳定';
    if (rows.length >= 2) {
      const recent = Number(rows[rows.length - 1].total_intake_weight) || 0;
      const older = Number(rows[0].total_intake_weight) || 0;
      if (older > 0) {
        const ch = ((recent - older) / older) * 100;
        if (ch > 10) trend = '上升';
        else if (ch < -10) trend = '下降';
      }
    }
    return {
      avg_initial: n ? sInit / n : 0,
      avg_intake: n ? si / n : 0,
      avg_remaining: n ? sr / n : 0,
      waste_rate,
      avg_calories: n ? sCal / n : 0,
      avg_speed: nSp > 0 ? sSp / nSp : 0,
      trend
    };
  }

  const thisWeek = aggregate(thisWeekRows || []);

  const prevEnd = new Date(endDate);
  prevEnd.setDate(prevEnd.getDate() - 7);
  const prevEndStr = prevEnd.toISOString().slice(0, 10);
  const lastWeekRows = await db.query(
    `SELECT * FROM Daily_Diet_Summary
     WHERE user_id = ? AND date <= ? AND date > DATE_SUB(?, INTERVAL 7 DAY)
     ORDER BY date ASC`,
    [userId, prevEndStr, prevEndStr]
  );
  const lastWeek = aggregate(lastWeekRows || []);

  const pct = (a, b) => (b && b !== 0 ? ((a - b) / b * 100).toFixed(1) : '—');
  return {
    startDate: String(startDate).slice(0, 10),
    endDate: String(endDate).slice(0, 10),
    avg_daily_initial_weight: thisWeek.avg_initial,
    avg_daily_intake: thisWeek.avg_intake,
    avg_daily_remaining_weight: thisWeek.avg_remaining,
    avg_waste_rate: thisWeek.waste_rate,
    avg_daily_calories: thisWeek.avg_calories,
    avg_eating_speed: thisWeek.avg_speed,
    intake_trend: thisWeek.trend,
    waste_trend: thisWeek.trend,
    speed_trend: thisWeek.trend,
    intake_change: pct(thisWeek.avg_intake, lastWeek.avg_intake),
    waste_change: pct(thisWeek.waste_rate, lastWeek.waste_rate),
    speed_change: pct(thisWeek.avg_speed, lastWeek.avg_speed),
    rows: thisWeekRows || []
  };
}

/** 报告 JSON 必需字段 */
const REQUIRED_FIELDS = [
  'diet_evaluation',
  'improvement_measures',
  'next_week_goals',
  'nutrition_score',
  'waste_score',
  'speed_score'
];

/**
 * 校验 AI 返回的分析结果结构
 * @param {object} result
 * @throws {Error} 缺少字段或分数超出范围
 */
function validateAnalysisResult(result) {
  if (!result || typeof result !== 'object') {
    throw new Error('分析结果必须为对象');
  }
  for (const field of REQUIRED_FIELDS) {
    if (!(field in result)) {
      throw new Error(`缺少必需字段: ${field}`);
    }
  }
  const scoreFields = ['nutrition_score', 'waste_score', 'speed_score'];
  for (const f of scoreFields) {
    const v = result[f];
    if (typeof v !== 'number' || v < 0 || v > 100) {
      throw new Error(`分数 ${f} 必须在 0-100 之间`);
    }
  }
  if (!Array.isArray(result.improvement_measures)) {
    throw new Error('improvement_measures 必须为数组');
  }
  if (!Array.isArray(result.next_week_goals)) {
    throw new Error('next_week_goals 必须为数组');
  }
}

/**
 * 从 AI 返回文本中提取 JSON 对象
 * @param {string} content
 * @returns {object}
 */
function extractJsonFromResponse(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('AI 返回内容为空');
  }
  const trimmed = content.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }
  throw new Error('AI 返回中未找到有效 JSON');
}

/**
 * 规则引擎降级：根据汇总数据与诊断生成基础报告（不调用 AI）
 * @param {object} summaryData - 当日/周期汇总
 * @param {{ issues: Array, warnings: Array }} diagnosis
 * @param {string} [reportType] - 'daily' | 'weekly'
 * @returns {object} 符合 validateAnalysisResult 的结构
 */
function generateFallbackReport(summaryData, diagnosis, reportType = 'daily') {
  const totalInitial = Number(summaryData.total_initial_weight) || 0;
  const totalRemaining = Number(summaryData.total_remaining_weight) || 0;
  const totalIntake = Number(summaryData.total_intake_weight) || 0;
  const wasteRate = calcWasteRate(totalInitial, totalRemaining);
  const avgSpeed = Number(summaryData.avg_eating_speed) || 0;

  let wasteScore = Math.max(0, 100 - wasteRate * 2);
  let speedScore = 75;
  if (avgSpeed > 50) speedScore = 60;
  else if (avgSpeed > 0 && avgSpeed < 10) speedScore = 70;

  const improvement_measures = [];
  if (diagnosis.issues && diagnosis.issues.length > 0) {
    diagnosis.issues.forEach(i => {
      if (i.suggestion) improvement_measures.push(i.suggestion);
    });
  }
  if (improvement_measures.length === 0) {
    improvement_measures.push('保持当前饮食节奏，注意营养均衡');
  }

  const diet_evaluation =
    `根据规则引擎分析：当日总摄入约 ${totalIntake}g，浪费率约 ${wasteRate.toFixed(1)}%。` +
    (diagnosis.issues.length > 0
      ? `存在需关注项：${diagnosis.issues.map(i => i.message).join('；')}。`
      : '整体在合理范围内。') +
    '建议结合个人体质与目标调整份量。';

  return {
    diet_evaluation,
    improvement_measures,
    next_week_goals: [
      '将浪费率控制在 15% 以下',
      '保持规律用餐与适中速度',
      '适量均衡搭配主食与蔬菜'
    ],
    nutrition_score: 75,
    waste_score: Math.round(wasteScore),
    speed_score: speedScore,
    _fallback: true
  };
}

/**
 * 保存分析报告到 AI_Analysis_Reports
 * @param {object} params
 * @param {number} params.user_id
 * @param {string} params.report_date - YYYY-MM-DD
 * @param {number} params.report_type - 1日报 2周报 3月报
 * @param {object} params.analysis_result - JSON
 * @param {string} [params.start_date]
 * @param {string} [params.end_date]
 * @param {string} [params.model_version]
 * @param {string} [params.prompt_version]
 */
async function saveAnalysisReport(params) {
  const sql = `
    INSERT INTO AI_Analysis_Reports
    (user_id, report_date, report_type, analysis_result, start_date, end_date, model_version, prompt_version)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const payload = JSON.stringify(params.analysis_result);
  await db.query(sql, [
    params.user_id,
    params.report_date,
    params.report_type,
    payload,
    params.start_date || null,
    params.end_date || null,
    params.model_version || null,
    params.prompt_version || null
  ]);
}

/**
 * 调用 OpenAI 生成饮食分析（若未配置 key 或失败则降级）
 * @param {number} userId
 * @param {string} date - YYYY-MM-DD
 * @param {'daily'|'weekly'} [reportType] - 默认 daily
 * @param {object} [options] - { forceFallback: boolean } 强制使用规则降级
 * @returns {Promise<object>} 分析结果（含 diagnosis），并已写入数据库
 */
async function generateDietAnalysis(userId, date, reportType = 'daily', options = {}) {
  const isWeekly = reportType === 'weekly';

  let summaryData;
  let historicalData;
  let weeklyData;
  if (isWeekly) {
    weeklyData = await getWeeklySummaryData(userId, date);
    summaryData = {
      total_initial_weight: weeklyData.avg_daily_initial_weight * 7,
      total_remaining_weight: weeklyData.avg_daily_remaining_weight * 7,
      total_intake_weight: weeklyData.avg_daily_intake * 7,
      avg_eating_speed: weeklyData.avg_eating_speed
    };
    historicalData = { avg_daily_intake: weeklyData.avg_daily_intake, avg_waste_rate: weeklyData.avg_waste_rate };
  } else {
    summaryData = await getDailySummary(userId, date);
    historicalData = await getHistoricalData(userId, date, 7);
  }

  const dataForDiagnosis = summaryData || {
    total_initial_weight: 0,
    total_remaining_weight: 0,
    total_intake_weight: 0,
    avg_eating_speed: 0
  };
  const diagnosis = diagnoseDietIssues(dataForDiagnosis, historicalData);
  const diagnosisText = formatDiagnosisForPrompt(diagnosis);

  const forceFallback = options.forceFallback === true;
  const apiKey = process.env.OPENAI_API_KEY;
  const hasData = isWeekly ? (weeklyData && weeklyData.rows && weeklyData.rows.length > 0) : summaryData;

  if (forceFallback || !apiKey || !hasData) {
    const fallback = generateFallbackReport(dataForDiagnosis, diagnosis, reportType);
    delete fallback._fallback;
    const toSave = { ...fallback, diagnosis: { issues: diagnosis.issues, warnings: diagnosis.warnings } };
    const start_date = isWeekly && weeklyData ? weeklyData.startDate : date;
    const end_date = isWeekly && weeklyData ? weeklyData.endDate : date;
    await saveAnalysisReport({
      user_id: userId,
      report_date: date,
      report_type: reportType === 'daily' ? REPORT_TYPE_DAILY : reportType === 'weekly' ? REPORT_TYPE_WEEKLY : REPORT_TYPE_MONTHLY,
      analysis_result: toSave,
      start_date,
      end_date,
      model_version: 'fallback',
      prompt_version: PROMPT_VERSION
    });
    return toSave;
  }

  let promptData;
  let templateType;
  let start_date;
  let end_date;

  if (isWeekly) {
    templateType = 'weekly_report';
    start_date = weeklyData.startDate;
    end_date = weeklyData.endDate;
    promptData = {
      userId,
      startDate: weeklyData.startDate,
      endDate: weeklyData.endDate,
      avg_daily_initial_weight: weeklyData.avg_daily_initial_weight,
      avg_daily_intake: weeklyData.avg_daily_intake,
      avg_daily_remaining_weight: weeklyData.avg_daily_remaining_weight,
      avg_waste_rate: weeklyData.avg_waste_rate.toFixed(1),
      avg_daily_calories: weeklyData.avg_daily_calories,
      avg_eating_speed: weeklyData.avg_eating_speed,
      intake_trend: weeklyData.intake_trend,
      waste_trend: weeklyData.waste_trend,
      speed_trend: weeklyData.speed_trend,
      intake_change: weeklyData.intake_change,
      waste_change: weeklyData.waste_change,
      speed_change: weeklyData.speed_change
    };
  } else {
    templateType = 'daily_report';
    start_date = date;
    end_date = date;
    const wasteRate = calcWasteRate(
      summaryData.total_initial_weight,
      summaryData.total_remaining_weight
    );
    promptData = {
      userId,
      date,
      ...summaryData,
      wasteRate: wasteRate.toFixed(1),
      avgWeeklyIntake: historicalData.avg_daily_intake,
      avgWeeklyWasteRate: historicalData.avg_waste_rate.toFixed(1),
      trend: historicalData.trend,
      diagnosisText: diagnosisText ? `## 规则引擎预诊断\n${diagnosisText}\n` : ''
    };
  }

  if (diagnosisText && !promptData.diagnosisText) {
    promptData.diagnosisText = `## 规则引擎预诊断\n${diagnosisText}\n`;
  }

  const { prompt, version } = generatePrompt(templateType, promptData);

  try {
    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey });

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || MODEL_VERSION,
      messages: [
        {
          role: 'system',
          content: '你是一位专业的营养师和饮食健康顾问，擅长分析饮食数据并提供个性化建议。请仅输出要求的 JSON，不要输出 markdown 代码块或其它说明。'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.6,
      max_tokens: 1500
    });

    const content = completion.choices[0]?.message?.content;
    let analysisResult = extractJsonFromResponse(content);
    validateAnalysisResult(analysisResult);
    analysisResult.diagnosis = { issues: diagnosis.issues, warnings: diagnosis.warnings };

    await saveAnalysisReport({
      user_id: userId,
      report_date: date,
      report_type: reportType === 'daily' ? REPORT_TYPE_DAILY : REPORT_TYPE_WEEKLY,
      analysis_result: analysisResult,
      start_date,
      end_date,
      model_version: process.env.OPENAI_MODEL || MODEL_VERSION,
      prompt_version: version
    });

    return analysisResult;
  } catch (err) {
    console.error('AI 分析生成失败，使用降级报告:', err.message);
    const fallback = generateFallbackReport(dataForDiagnosis, diagnosis, reportType);
    delete fallback._fallback;
    const toSave = { ...fallback, diagnosis: { issues: diagnosis.issues, warnings: diagnosis.warnings } };
    const saveStart = isWeekly && weeklyData ? weeklyData.startDate : date;
    const saveEnd = isWeekly && weeklyData ? weeklyData.endDate : date;
    await saveAnalysisReport({
      user_id: userId,
      report_date: date,
      report_type: reportType === 'daily' ? REPORT_TYPE_DAILY : REPORT_TYPE_WEEKLY,
      analysis_result: toSave,
      start_date: saveStart,
      end_date: saveEnd,
      model_version: 'fallback',
      prompt_version: PROMPT_VERSION
    });
    return toSave;
  }
}

/**
 * 查询用户某日的分析报告（若存在）
 * @param {number} userId
 * @param {string} reportDate - YYYY-MM-DD
 * @param {number} [reportType] - 1 日报 2 周报 3 月报，不传则取最新一条
 * @returns {Promise<object|null>} 含 analysis_result（已解析为对象）
 */
async function getAnalysisReport(userId, reportDate, reportType) {
  let sql = 'SELECT * FROM AI_Analysis_Reports WHERE user_id = ? AND report_date = ?';
  const params = [userId, reportDate];
  if (reportType != null) {
    sql += ' AND report_type = ?';
    params.push(reportType);
  }
  sql += ' ORDER BY created_at DESC LIMIT 1';
  const rows = await db.query(sql, params);
  if (!rows || !rows[0]) return null;
  const row = rows[0];
  let analysis_result = row.analysis_result;
  if (typeof analysis_result === 'string') {
    try {
      analysis_result = JSON.parse(analysis_result);
    } catch (_) {
      return null;
    }
  }
  return { ...row, analysis_result };
}

module.exports = {
  getDailySummary,
  getHistoricalData,
  getWeeklySummaryData,
  validateAnalysisResult,
  extractJsonFromResponse,
  generateFallbackReport,
  saveAnalysisReport,
  generateDietAnalysis,
  getAnalysisReport,
  REPORT_TYPE_DAILY,
  REPORT_TYPE_WEEKLY,
  REPORT_TYPE_MONTHLY
};

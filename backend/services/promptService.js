/**
 * Prompt 模板与动态生成
 * 模块5 阶段三 5-3-1：日报、周报提示词工程
 * @module services/promptService
 */

const PROMPT_VERSION = '1.0';

/** @type {Record<string, string>} 日报模板占位符说明 */
const DAILY_PLACEHOLDERS = {
  userId: '用户ID',
  date: '分析日期',
  age: '用户年龄（可选）',
  totalInitialWeight: '总打饭量(g)',
  totalIntakeWeight: '总摄入量(g)',
  totalRemainingWeight: '总剩余量(g)',
  wasteRate: '浪费率(%)',
  totalCalories: '总卡路里(kcal)',
  avgEatingSpeed: '平均用餐速度(g/min)',
  mealCount: '用餐次数',
  avgWeeklyIntake: '近7日平均每日摄入量(g)',
  avgWeeklyWasteRate: '近7日平均浪费率(%)',
  trend: '趋势：上升/下降/稳定',
  diagnosisText: '规则诊断摘要（可选）'
};

/** 日报 Prompt 模板 */
const DAILY_REPORT_TEMPLATE = `
你是一位专业的营养师和饮食健康顾问。请根据以下用户的饮食数据，生成一份专业的饮食分析报告。

## 用户基本信息
- 用户ID: {userId}
- 分析日期: {date}
- 用户年龄: {age}岁（如果未知可写「未提供」）

## 当日饮食数据
- 总打饭量: {totalInitialWeight}g
- 总摄入量: {totalIntakeWeight}g
- 总剩余量: {totalRemainingWeight}g
- 浪费率: {wasteRate}%
- 总卡路里: {totalCalories}kcal
- 平均用餐速度: {avgEatingSpeed}g/min
- 用餐次数: {mealCount}次

## 最近7天对比数据
- 平均每日摄入量: {avgWeeklyIntake}g
- 平均每日浪费率: {avgWeeklyWasteRate}%
- 趋势: {trend}

{diagnosisText}

## 要求
请**仅**返回一个合法的 JSON 对象，不要包含其他说明文字。格式如下：

{
    "diet_evaluation": "对用户当日饮食情况的综合评价（200-300字）",
    "improvement_measures": [
        "改进措施1（具体可操作的建议）",
        "改进措施2",
        "改进措施3"
    ],
    "next_week_goals": [
        "下周目标1（具体可量化的目标）",
        "下周目标2",
        "下周目标3"
    ],
    "nutrition_score": 85,
    "waste_score": 90,
    "speed_score": 75
}

说明：nutrition_score 为营养均衡得分(0-100)，waste_score 为浪费控制得分(0-100)，speed_score 为用餐速度得分(0-100)。请开始分析并只输出上述 JSON。
`;

/** 周报 Prompt 模板 */
const WEEKLY_REPORT_TEMPLATE = `
你是一位专业的营养师和饮食健康顾问。请根据用户一周的饮食数据，生成一份周度分析报告。

## 用户基本信息
- 用户ID: {userId}
- 分析周期: {startDate} 至 {endDate}

## 本周饮食数据汇总
- 平均每日打饭量: {avgDailyInitialWeight}g
- 平均每日摄入量: {avgDailyIntakeWeight}g
- 平均每日剩余量: {avgDailyRemainingWeight}g
- 平均浪费率: {avgWasteRate}%
- 平均每日卡路里: {avgDailyCalories}kcal
- 平均用餐速度: {avgEatingSpeed}g/min

## 本周趋势分析
- 摄入量趋势: {intakeTrend}
- 浪费率趋势: {wasteTrend}
- 用餐速度趋势: {speedTrend}

## 与上周对比（如有数据）
- 摄入量变化: {intakeChange}%
- 浪费率变化: {wasteChange}%
- 用餐速度变化: {speedChange}%

## 要求
请**仅**返回一个合法的 JSON 对象，不要包含其他说明。格式与日报一致，包含：diet_evaluation、improvement_measures、next_week_goals、nutrition_score、waste_score、speed_score。请开始分析并只输出 JSON。
`;

const TEMPLATES = {
  daily_report: DAILY_REPORT_TEMPLATE,
  weekly_report: WEEKLY_REPORT_TEMPLATE
};

/**
 * 将对象中的占位符 {key} 替换为 data[key]
 * @param {string} template - 模板字符串
 * @param {Record<string, string|number|null|undefined>} data - 键值对
 * @returns {string}
 */
function replacePlaceholders(template, data) {
  let out = template;
  for (const [key, value] of Object.entries(data)) {
    const regex = new RegExp(`\\{${key}\\}`, 'g');
    const str = value == null || value === '' ? '未知' : String(value);
    out = out.replace(regex, str);
  }
  return out;
}

/**
 * 生成日报 Prompt
 * @param {object} data - 包含 userId, date, 当日汇总字段、近7日统计、trend、诊断摘要等
 * @returns {string}
 */
function generateDailyPrompt(data) {
  const wasteRate = data.wasteRate != null
    ? Number(data.wasteRate).toFixed(1)
    : (data.totalInitialWeight > 0
      ? ((Number(data.totalRemainingWeight) / Number(data.totalInitialWeight)) * 100).toFixed(1)
      : '0');
  const payload = {
    userId: data.userId ?? data.user_id ?? '未知',
    date: data.date ?? '未知',
    age: data.age ?? '未提供',
    totalInitialWeight: data.totalInitialWeight ?? data.total_initial_weight ?? 0,
    totalIntakeWeight: data.totalIntakeWeight ?? data.total_intake_weight ?? 0,
    totalRemainingWeight: data.totalRemainingWeight ?? data.total_remaining_weight ?? 0,
    wasteRate,
    totalCalories: data.totalCalories ?? data.total_calories ?? 0,
    avgEatingSpeed: data.avgEatingSpeed ?? data.avg_eating_speed ?? 0,
    mealCount: data.mealCount ?? data.meal_count ?? 0,
    avgWeeklyIntake: data.avgWeeklyIntake ?? data.avg_daily_intake ?? 0,
    avgWeeklyWasteRate: data.avgWeeklyWasteRate ?? data.avg_waste_rate ?? 0,
    trend: data.trend ?? '稳定',
    diagnosisText: data.diagnosisText ?? data.diagnosis_text ?? ''
  };
  return replacePlaceholders(DAILY_REPORT_TEMPLATE, payload);
}

/**
 * 生成周报 Prompt
 * @param {object} data - 包含 userId, startDate, endDate, 本周汇总、趋势、与上周对比等
 * @returns {string}
 */
function generateWeeklyPrompt(data) {
  const payload = {
    userId: data.userId ?? data.user_id ?? '未知',
    startDate: data.startDate ?? data.start_date ?? '未知',
    endDate: data.endDate ?? data.end_date ?? '未知',
    avgDailyInitialWeight: data.avgDailyInitialWeight ?? data.avg_daily_initial_weight ?? 0,
    avgDailyIntakeWeight: data.avgDailyIntakeWeight ?? data.avg_daily_intake ?? 0,
    avgDailyRemainingWeight: data.avgDailyRemainingWeight ?? data.avg_daily_remaining_weight ?? 0,
    avgWasteRate: data.avgWasteRate ?? data.avg_waste_rate ?? 0,
    avgDailyCalories: data.avgDailyCalories ?? data.avg_daily_calories ?? 0,
    avgEatingSpeed: data.avgEatingSpeed ?? data.avg_eating_speed ?? 0,
    intakeTrend: data.intakeTrend ?? data.intake_trend ?? '数据不足',
    wasteTrend: data.wasteTrend ?? data.waste_trend ?? '数据不足',
    speedTrend: data.speedTrend ?? data.speed_trend ?? '数据不足',
    intakeChange: data.intakeChange ?? data.intake_change ?? '—',
    wasteChange: data.wasteChange ?? data.waste_change ?? '—',
    speedChange: data.speedChange ?? data.speed_change ?? '—'
  };
  return replacePlaceholders(WEEKLY_REPORT_TEMPLATE, payload);
}

/**
 * 根据类型生成 Prompt
 * @param {'daily_report'|'weekly_report'} templateType
 * @param {Record<string, string|number|null|undefined>} data
 * @returns {{ prompt: string, version: string }}
 */
function generatePrompt(templateType, data) {
  const template = TEMPLATES[templateType];
  if (!template) {
    throw new Error(`未知模板类型: ${templateType}`);
  }
  const prompt = templateType === 'daily_report'
    ? generateDailyPrompt(data)
    : generateWeeklyPrompt(data);
  return { prompt, version: PROMPT_VERSION };
}

module.exports = {
  PROMPT_VERSION,
  DAILY_PLACEHOLDERS,
  TEMPLATES,
  generatePrompt,
  generateDailyPrompt,
  generateWeeklyPrompt,
  replacePlaceholders
};

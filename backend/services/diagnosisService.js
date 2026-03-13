/**
 * 饮食自动化诊断规则引擎
 * 模块5 阶段三 5-3-2：浪费率、摄入量、用餐速度等规则诊断
 * @module services/diagnosisService
 */

/**
 * 计算浪费率（%）
 * @param {number} totalInitialWeight - 总打饭量(g)
 * @param {number} totalRemainingWeight - 总剩余量(g)
 * @returns {number} 0-100
 */
function calcWasteRate(totalInitialWeight, totalRemainingWeight) {
  if (!totalInitialWeight || totalInitialWeight <= 0) return 0;
  return (Number(totalRemainingWeight) / Number(totalInitialWeight)) * 100;
}

/**
 * 根据当日汇总与历史数据做规则诊断
 * @param {object} summaryData - 当日/当周期汇总：total_initial_weight, total_remaining_weight, total_intake_weight, avg_eating_speed 等
 * @param {object} [historicalData] - 历史统计：avg_daily_intake, avg_waste_rate 等
 * @returns {{ issues: Array<{type: string, severity: string, message: string, suggestion?: string}>, warnings: Array<{type: string, message: string}> }}
 */
function diagnoseDietIssues(summaryData, historicalData = {}) {
  const issues = [];
  const warnings = [];

  const totalInitial = Number(summaryData.total_initial_weight) || 0;
  const totalRemaining = Number(summaryData.total_remaining_weight) || 0;
  const totalIntake = Number(summaryData.total_intake_weight) || 0;
  const avgSpeed = Number(summaryData.avg_eating_speed) || 0;

  const wasteRate = calcWasteRate(totalInitial, totalRemaining);

  // 规则1：浪费率过高
  if (wasteRate > 20) {
    issues.push({
      type: 'high_waste',
      severity: 'high',
      message: `浪费率过高（${wasteRate.toFixed(1)}%），建议减少打饭量`,
      suggestion: '建议每次打饭时减少10-15%的分量，或先打少量不够再加'
    });
  } else if (wasteRate > 15) {
    warnings.push({
      type: 'moderate_waste',
      message: `浪费率偏高（${wasteRate.toFixed(1)}%）`
    });
  }

  // 规则2：摄入量不足（有历史均值时对比）
  const avgIntake = historicalData.avg_daily_intake != null ? Number(historicalData.avg_daily_intake) : 0;
  if (avgIntake > 0 && totalIntake < avgIntake * 0.8) {
    issues.push({
      type: 'low_intake',
      severity: 'medium',
      message: '今日摄入量明显低于近期平均水平',
      suggestion: '建议适当增加打饭量，确保营养充足'
    });
  }

  // 规则3：用餐速度异常
  if (avgSpeed > 50) {
    warnings.push({
      type: 'fast_eating',
      message: '用餐速度过快，可能影响消化吸收'
    });
  } else if (avgSpeed > 0 && avgSpeed < 10) {
    warnings.push({
      type: 'slow_eating',
      message: '用餐速度过慢，可能导致饭菜变凉'
    });
  }

  return { issues, warnings };
}

/**
 * 将诊断结果格式化为可放入 Prompt 的简短文本
 * @param {{ issues: Array, warnings: Array }} diagnosis
 * @returns {string}
 */
function formatDiagnosisForPrompt(diagnosis) {
  const lines = [];
  if (diagnosis.issues && diagnosis.issues.length > 0) {
    lines.push('## 规则引擎诊断（需关注）');
    diagnosis.issues.forEach(i => {
      lines.push(`- ${i.message}${i.suggestion ? `；${i.suggestion}` : ''}`);
    });
  }
  if (diagnosis.warnings && diagnosis.warnings.length > 0) {
    lines.push('## 规则引擎提示');
    diagnosis.warnings.forEach(w => lines.push(`- ${w.message}`));
  }
  if (lines.length === 0) return '';
  return lines.join('\n');
}

module.exports = {
  calcWasteRate,
  diagnoseDietIssues,
  formatDiagnosisForPrompt
};

/**
 * 个性化饮食建议：基于最近分析报告与历史数据生成推荐列表
 * 模块5 阶段三 5-3-4（简化版：无独立用户画像表时，从报告与诊断推导）
 * @module services/recommendationService
 */

const db = require('../config/db');
const { getAnalysisReport, getHistoricalData } = require('./aiAnalysisService');

/**
 * 获取用户最近 N 条分析报告的日期
 * @param {number} userId
 * @param {number} limit
 * @returns {Promise<Array<{ report_date: string, analysis_result: object }>>}
 */
async function getRecentReports(userId, limit = 5) {
  const rows = await db.query(
    `SELECT report_date, analysis_result FROM AI_Analysis_Reports
     WHERE user_id = ? ORDER BY report_date DESC LIMIT ?`,
    [userId, limit]
  );
  const out = [];
  for (const r of rows || []) {
    let analysis_result = r.analysis_result;
    if (typeof analysis_result === 'string') {
      try {
        analysis_result = JSON.parse(analysis_result);
      } catch (_) {
        continue;
      }
    }
    out.push({ report_date: r.report_date, analysis_result });
  }
  return out;
}

/**
 * 基于最近报告与诊断生成个性化建议列表
 * @param {number} userId
 * @returns {Promise<Array<{ type: string, priority: string, message: string, suggestions?: string[] }>>}
 */
async function getPersonalizedRecommendations(userId) {
  const recommendations = [];
  const today = new Date().toISOString().slice(0, 10);

  const recentReports = await getRecentReports(userId, 5);
  const latest = recentReports[0];
  if (latest && latest.analysis_result) {
    const ar = latest.analysis_result;
    if (Array.isArray(ar.improvement_measures) && ar.improvement_measures.length > 0) {
      recommendations.push({
        type: 'improvement',
        priority: 'high',
        message: '基于最近分析报告的改进建议',
        suggestions: ar.improvement_measures
      });
    }
    if (Array.isArray(ar.next_week_goals) && ar.next_week_goals.length > 0) {
      recommendations.push({
        type: 'goals',
        priority: 'medium',
        message: '建议的下周目标',
        suggestions: ar.next_week_goals
      });
    }
    if (ar.diagnosis && (ar.diagnosis.issues?.length > 0 || ar.diagnosis.warnings?.length > 0)) {
      const items = [
        ...(ar.diagnosis.issues || []).map(i => i.message + (i.suggestion ? `（${i.suggestion}）` : '')),
        ...(ar.diagnosis.warnings || []).map(w => w.message)
      ];
      if (items.length > 0) {
        recommendations.push({
          type: 'diagnosis',
          priority: 'high',
          message: '规则引擎诊断提示',
          suggestions: items
        });
      }
    }
  }

  const historical = await getHistoricalData(userId, today, 14);
  if (historical.rows && historical.rows.length > 0 && historical.avg_waste_rate > 15) {
    recommendations.push({
      type: 'waste_reduction',
      priority: 'high',
      message: '近期浪费率偏高，建议采取以下措施',
      suggestions: [
        '打饭时主动要求减少 10–15% 的分量',
        '先打少量，不够再加',
        '尽量按需取餐减少剩余'
      ]
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      type: 'general',
      priority: 'low',
      message: '暂无专项建议',
      suggestions: ['保持规律用餐', '注意营养均衡', '适量不浪费']
    });
  }

  return recommendations;
}

module.exports = {
  getRecentReports,
  getPersonalizedRecommendations
};

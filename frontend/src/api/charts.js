/**
 * 个人饮食图表 API（v4.1：云端聚合版）
 */

import { get } from './client';

// 保持前端原有 5 种图表类型，方便复用 UI
const CHART_TYPES = ['daily_trend', 'weekly_comparison', 'waste_analysis', 'speed_analysis', 'nutrition_pie'];

/**
 * 请求图表数据（云端 /users/me/statistics/charts）
 * - 不传 user_id，后端从 JWT 解析当前用户
 * - 后端返回结构示例：
 *   {
 *     "user_id": "uuid",
 *     "date_range": ["2026-03-01","2026-03-14"],
 *     "chart_data": {
 *       "dates": ["03-01", "03-02", ...],
 *       "daily_served_g": [...],
 *       "daily_intake_g": [...],
 *       "daily_calories": [...],
 *       "avg_speed_g_per_min": [...]
 *     }
 *   }
 * @param {{ start_date: string, end_date: string }}
 * @returns {Promise<{ user_id: string, date_range: string[], chart_data: object }>}
 */
export function fetchChartData({ start_date, end_date }) {
  const params = new URLSearchParams({ start_date, end_date });
  return get(`/api/v1/users/me/statistics/charts?${params}`);
}

export { CHART_TYPES };

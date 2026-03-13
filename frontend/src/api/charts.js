/**
 * 阶段二图表 API
 */

import { get } from './client';

const CHART_TYPES = ['daily_trend', 'weekly_comparison', 'waste_analysis', 'speed_analysis', 'nutrition_pie'];

/**
 * @param {{ user_id: number, start_date: string, end_date: string, chart_type: string }}
 * @returns {Promise<{ code: number, data: object }>}
 */
export function fetchChartData({ user_id, start_date, end_date, chart_type }) {
  const params = new URLSearchParams({ user_id, start_date, end_date, chart_type: chart_type || 'daily_trend' });
  return get(`/api/diet/statistics/charts?${params}`);
}

export { CHART_TYPES };

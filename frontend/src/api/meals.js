/**
 * v4.0 用餐记录 API（智能餐盒数据，鉴权后按当前用户过滤）
 */

import { get } from './client';

/**
 * 历史用餐列表（游标分页）
 * @param {{ cursor?: string, limit?: number }}
 * @returns {Promise<{ items: Array<{ meal_id, start_time, duration_minutes, total_meal_cal }>, next_cursor: string }>}
 */
export function fetchMeals({ cursor, limit } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit != null) params.set('limit', String(limit));
  const q = params.toString() ? `?${params}` : '';
  return get(`/api/v1/meals${q}`);
}

/**
 * 获取就餐时序轨迹（降采样支持）
 * @param {string} mealId - 用餐ID
 * @param {{ lastTimestamp?: string, sampleInterval?: number }}
 * @returns {Promise<{ meal_id: string, items: Array<{ timestamp: string, weights: object }>, last_timestamp: string }>}
 */
export function fetchMealTrajectory(mealId, { lastTimestamp, sampleInterval } = {}) {
  const params = new URLSearchParams();
  if (lastTimestamp) params.set('last_timestamp', lastTimestamp);
  if (sampleInterval != null) params.set('sample_interval', String(sampleInterval));
  const q = params.toString() ? `?${params}` : '';
  return get(`/api/v1/meals/${mealId}/trajectory${q}`);
}

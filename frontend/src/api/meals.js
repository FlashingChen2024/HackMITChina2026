import { get, put, post } from './client';

/**
 * History meals list (cursor pagination).
 * GET /meals
 */
export function fetchMeals({ cursor, limit } = {}) {
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  if (limit != null) params.set('limit', String(limit));
  const q = params.toString() ? `?${params}` : '';
  return get(`/api/v1/meals${q}`);
}

/**
 * Single meal detail.
 * GET /meals/{meal_id}
 */
export function fetchMealDetail(mealId) {
  return get(`/api/v1/meals/${encodeURIComponent(mealId)}`);
}

/**
 * 菜品挂载与卡路里点火（API v4.4 §4.1）。
 * `PUT /api/v1/meals/{meal_id}/foods`，请求体仅包含规范内字段。
 *
 * @param {string} mealId 餐次 ID
 * @param {{ grid_index: number, food_name: string, unit_cal_per_100g: number }[]} grids
 * @returns {Promise<{ message?: string }>}
 */
export function updateMealFoods(mealId, grids) {
  return put(`/api/v1/meals/${encodeURIComponent(mealId)}/foods`, { grids });
}

/**
 * 视觉识别结果确认挂载（API v4.4 §9.3）。
 * `POST /api/v1/meals/{meal_id}/vision-confirm`
 *
 * @param {string} mealId 餐次 ID
 * @param {{ grid_index: number, food_code: string }[]} grids
 * @returns {Promise<{ message?: string }>}
 */
export function confirmMealVision(mealId, grids) {
  return post(`/api/v1/meals/${encodeURIComponent(mealId)}/vision-confirm`, { grids });
}

/**
 * Meal trajectory (supports incremental query and downsampling).
 * GET /meals/{meal_id}/trajectory
 */
export function fetchMealTrajectory(mealId, { lastTimestamp, sampleInterval } = {}) {
  const params = new URLSearchParams();
  if (lastTimestamp) params.set('last_timestamp', lastTimestamp);
  if (sampleInterval != null) params.set('sample_interval', String(sampleInterval));
  const q = params.toString() ? `?${params}` : '';
  return get(`/api/v1/meals/${encodeURIComponent(mealId)}/trajectory${q}`);
}

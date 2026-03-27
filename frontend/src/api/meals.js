import { get, put } from './client';

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
 * Attach foods to grids for a meal.
 * PUT /meals/{meal_id}/foods
 */
export function updateMealFoods(mealId, grids) {
  return put(`/api/v1/meals/${encodeURIComponent(mealId)}/foods`, { grids });
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

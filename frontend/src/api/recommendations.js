import { get } from './client';

/**
 * 获取个性化建议；不传 user_id 时后端使用当前登录用户（JWT）
 * @param {number} [user_id]
 */
export function fetchRecommendations(user_id) {
  const q = user_id != null && Number.isFinite(Number(user_id)) ? `?user_id=${user_id}` : '';
  return get(`/api/diet/recommendations${q}`);
}

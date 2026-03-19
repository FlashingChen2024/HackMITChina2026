import { get, post } from './client';

/**
 * 创建社区
 * @param {{ name: string, description?: string }} payload
 * @returns {Promise<{ community_id: string, message: string }>}
 */
export function createCommunity(payload) {
  return post('/api/v1/communities/create', payload);
}

/**
 * 通过社区 ID 加入社区
 * @param {string} communityId
 * @returns {Promise<{ message: string }>}
 */
export function joinCommunity(communityId) {
  return post(`/api/v1/communities/${encodeURIComponent(communityId)}/join`, {});
}

/**
 * 获取社区 Dashboard 聚合数据
 * @param {string} communityId
 * @returns {Promise<{ community_id: string, community_name: string, member_count: number, food_avg_stats: Array<{ food_name: string, avg_served_g: number, avg_leftover_g: number, avg_intake_g: number, avg_speed_g_per_min: number }> }>}
 */
export function getCommunityDashboard(communityId) {
  return get(`/api/v1/communities/${encodeURIComponent(communityId)}/dashboard`);
}


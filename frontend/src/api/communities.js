import { post, get } from './client';

/**
 * 创建社区
 * @param {string} name - 社区名称
 * @param {string} description - 社区描述
 * @returns {Promise} 返回 {community_id, message}
 */
export function createCommunity(name, description) {
  return post('/communities/create', { name, description });
}

/**
 * 加入社区
 * @param {string} communityId - 社区ID
 * @returns {Promise} 返回 {message}
 */
export function joinCommunity(communityId) {
  return post(`/communities/${communityId}/join`, {});
}

/**
 * 获取社区仪表板数据
 * @param {string} communityId - 社区ID
 * @returns {Promise} 返回社区统计数据
 */
export function fetchCommunityDashboard(communityId) {
  return get(`/communities/${communityId}/dashboard`);
}

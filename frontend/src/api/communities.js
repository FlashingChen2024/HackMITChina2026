import { get, post } from './client';

/**
 * POST /communities/create
 */
export function createCommunity(payload) {
  return post('/api/v1/communities/create', payload);
}

/**
 * POST /communities/{community_id}/join
 */
export function joinCommunity(communityId) {
  return post(`/api/v1/communities/${encodeURIComponent(communityId)}/join`, {});
}

/**
 * GET /communities
 */
export function listCommunities() {
  return get('/api/v1/communities');
}

/**
 * GET /communities/{community_id}/dashboard
 */
export function getCommunityDashboard(communityId) {
  return get(`/api/v1/communities/${encodeURIComponent(communityId)}/dashboard`);
}

// Backward compatibility alias for older page imports.
export const fetchCommunityDashboard = getCommunityDashboard;

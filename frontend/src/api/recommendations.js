import { get } from './client';

export function fetchRecommendations(user_id) {
  return get(`/api/diet/recommendations?user_id=${user_id}`);
}

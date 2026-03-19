import { get } from './client';

/**
 * v4.2：云端 AI 智能营养师建议（统一返回建议）
 * @param {{ type: 'meal_review'|'daily_alert'|'next_meal' }}
 * @returns {Promise<{ type: string, advice: string, is_alert: boolean }>}
 */
export function fetchAiAdvice({ type }) {
  const params = new URLSearchParams({ type });
  return get(`/api/v1/users/me/ai-advice?${params}`);
}

/**
 * v4.2：AI 智能营养师（用于“AI 报告”页面）
 */

import { get } from './client';

/**
 * 获取 AI 建议（报告/提醒/下一顿）
 * @param {{ type: 'meal_review'|'daily_alert'|'next_meal' }} params
 * @returns {Promise<{ type: string, advice: string, is_alert: boolean }>}
 */
export function fetchAiAdvice({ type }) {
  const params = new URLSearchParams({ type });
  return get(`/api/v1/users/me/ai-advice?${params}`);
}

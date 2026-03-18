/**
 * AI 报告 API
 */

import { get, post } from './client';

export function generateReport(body) {
  return post('/api/diet/analysis/generate', body);
}

/**
 * 获取报告；不传 user_id 时后端使用当前登录用户（JWT）
 */
export function getReport(date, report_type, user_id) {
  const params = new URLSearchParams({ date });
  if (report_type != null) params.set('report_type', report_type);
  if (user_id != null && Number.isFinite(Number(user_id))) params.set('user_id', String(user_id));
  return get(`/api/diet/analysis/report?${params}`);
}

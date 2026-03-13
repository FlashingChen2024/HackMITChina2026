/**
 * AI 报告 API
 */

import { get, post } from './client';

export function generateReport(body) {
  return post('/api/diet/analysis/generate', body);
}

export function getReport(user_id, date, report_type) {
  const params = new URLSearchParams({ user_id, date });
  if (report_type != null) params.set('report_type', report_type);
  return get(`/api/diet/analysis/report?${params}`);
}

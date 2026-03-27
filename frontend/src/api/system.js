import { get, post } from './client';

/**
 * GET /ping
 */
export function ping() {
  return get('/api/v1/ping');
}

/**
 * POST /hardware/telemetry
 */
export function reportTelemetry(payload) {
  return post('/api/v1/hardware/telemetry', payload);
}

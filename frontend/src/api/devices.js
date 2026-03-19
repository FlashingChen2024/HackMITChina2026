import { get, post, del } from './client';

/** v4.0 当前用户已绑定设备（鉴权后无需 user_id） */
export function listBindings() {
  // v4.2：查询当前用户设备列表（从 JWT 中解析 user）
  return get('/api/v1/devices');
}

export function bind(device_id) {
  return post('/api/v1/devices/bind', { device_id });
}

export function unbind(device_id) {
  // v4.2：解绑设备
  return del(`/api/v1/devices/${encodeURIComponent(device_id)}`);
}

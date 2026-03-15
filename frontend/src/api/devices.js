import { get, post, del } from './client';

/** v4.0 当前用户已绑定设备（鉴权后无需 user_id） */
export function listBindings() {
  return get('/api/v1/devices/bindings');
}

export function bind(device_id) {
  return post('/api/v1/devices/bind', { device_id });
}

export function unbind(device_id) {
  return del(`/api/v1/devices/bindings/${encodeURIComponent(device_id)}`);
}

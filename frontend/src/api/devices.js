import { get, post, del } from './client';

export function listBindings(user_id) {
  return get(`/api/v1/devices/bindings?user_id=${user_id}`);
}

export function getBinding(device_id) {
  return get(`/api/v1/devices/bindings/${encodeURIComponent(device_id)}`);
}

export function bind(device_id, user_id) {
  return post('/api/v1/devices/bindings', { device_id, user_id });
}

export function unbind(device_id) {
  return del(`/api/v1/devices/bindings/${encodeURIComponent(device_id)}`);
}

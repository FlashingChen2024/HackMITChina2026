import { get, put } from './client';

/**
 * 获取个人健康画像（API v4.4 §8.1）。
 * `GET /api/v1/users/me/profile`
 *
 * @returns {Promise<{ user_id: string, gender?: string, age?: number, height_cm?: number, weight_kg?: number, updated_at?: string }>}
 */
export function fetchProfile() {
  return get('/api/v1/users/me/profile');
}

/**
 * 更新个人健康画像 Upsert（API v4.4 §8.2）。
 * `PUT /api/v1/users/me/profile`
 *
 * @param {{ gender: string, age: number, height_cm: number, weight_kg: number }} body
 * @returns {Promise<{ message?: string, updated_at?: string }>}
 */
export function updateProfile(body) {
  return put('/api/v1/users/me/profile', body);
}

import { get, put } from './client';

/**
 * 获取告警设置。
 * `GET /api/v1/users/me/alert-setting`
 *
 * @returns {Promise<{ email?: string, enabled?: boolean }>}
 */
export function fetchAlertSetting() {
  return get('/api/v1/users/me/alert-setting').then((data) => {
    const setting = data.alert_setting || data;
    return {
      email: setting.email || '',
      enabled: !!setting.enabled,
    };
  });
}

/**
 * 更新告警设置。
 * `PUT /api/v1/users/me/alert-setting`
 *
 * @param {{ email: string, enabled: boolean }} body
 * @returns {Promise<{ message?: string }>}
 */
export function updateAlertSetting(body) {
  return put('/api/v1/users/me/alert-setting', body);
}

/**
 * 将接口返回（snake_case 或 camelCase）统一为前端使用的 snake_case 结构。
 *
 * @param {Record<string, unknown> | null | undefined} raw
 * @returns {{ user_id?: string, gender?: string, age?: number | null, height_cm?: number | null, weight_kg?: number | null, updated_at?: string }}
 */
export function normalizeProfilePayload(raw) {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  /** @type {Record<string, unknown>} */
  let r = raw;
  const wrapped = raw.profile ?? raw.data ?? raw.user_profile;
  if (wrapped && typeof wrapped === 'object' && !Array.isArray(wrapped)) {
    r = { ...raw, ...wrapped };
  }

  const user_id = r.user_id ?? r.userId ?? r.userID;
  let gender = r.gender;
  if (typeof gender === 'string') {
    const map = { 男: 'male', 女: 'female', 其他: 'other', male: 'male', female: 'female', other: 'other' };
    gender = map[gender] ?? gender;
  }
  const ageRaw = r.age;
  const age = ageRaw != null && ageRaw !== '' ? Number(ageRaw) : null;
  const h = r.height_cm ?? r.heightCm ?? r.HeightCm;
  const height_cm = h != null && h !== '' ? Number(h) : null;
  const w = r.weight_kg ?? r.weightKg ?? r.WeightKg;
  const weight_kg = w != null && w !== '' ? Number(w) : null;
  const updated_at = r.updated_at ?? r.updatedAt;

  return {
    ...(user_id != null && user_id !== '' ? { user_id: String(user_id) } : {}),
    ...(typeof gender === 'string' && gender ? { gender } : {}),
    age: age != null && !Number.isNaN(age) ? age : null,
    height_cm: height_cm != null && !Number.isNaN(height_cm) ? height_cm : null,
    weight_kg: weight_kg != null && !Number.isNaN(weight_kg) ? weight_kg : null,
    ...(updated_at != null && String(updated_at) !== ''
      ? { updated_at: String(updated_at) }
      : {}),
  };
}

/**
 * 获取个人健康画像（API v4.4 §8.1）。
 * `GET /api/v1/users/me/profile`
 *
 * @returns {Promise<Record<string, unknown>>}
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

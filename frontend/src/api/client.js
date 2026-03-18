/**
 * v4.0 统一请求：baseURL、JSON、鉴权（除 /auth 外自动带 Bearer Token）
 */

const BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem('token') || '';
}

/**
 * 从 JWT 解析当前用户（仅解码 payload，不校验签名）
 * @returns {{ userId: number, username: string } | null}
 */
export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const userId = payload.userId != null ? Number(payload.userId) : null;
    if (userId == null || !Number.isFinite(userId)) return null;
    return { userId, username: payload.username || '' };
  } catch (_) {
    return null;
  }
}

export function setToken(token) {
  if (token) localStorage.setItem('token', token);
  else localStorage.removeItem('token');
}

export async function request(path, options = {}) {
  const url = path.startsWith('http') ? path : `${BASE}${path}`;
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token && !path.includes('/auth/')) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || data.error || `HTTP ${res.status}`);
  }
  return data;
}

export function get(path) {
  return request(path, { method: 'GET' });
}

export function post(path, body) {
  return request(path, { method: 'POST', body: JSON.stringify(body || {}) });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}

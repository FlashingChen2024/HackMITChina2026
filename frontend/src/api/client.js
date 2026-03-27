const BASE = import.meta.env.VITE_API_BASE || '';

export function getToken() {
  return localStorage.getItem('token') || '';
}

/**
 * Decode JWT payload only (without signature validation).
 * Keeps both userId and user_id for compatibility.
 * @returns {{ userId: string, user_id: string, username: string } | null}
 */
export function getCurrentUser() {
  const token = getToken();
  if (!token) return null;

  try {
    const payloadBase64 = token.split('.')[1];
    if (!payloadBase64) return null;

    const normalized = payloadBase64.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));

    const rawUserId = payload.user_id ?? payload.userId ?? payload.sub;
    if (rawUserId == null || rawUserId === '') return null;

    const userId = String(rawUserId);
    return {
      userId,
      user_id: userId,
      username: payload.username || '',
    };
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

export function put(path, body) {
  return request(path, { method: 'PUT', body: JSON.stringify(body || {}) });
}

export function del(path) {
  return request(path, { method: 'DELETE' });
}

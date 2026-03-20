/**
 * v4.0 鉴权 API
 */

import { post, setToken } from './client';

export async function register(username, password) {
  const res = await post('/api/v1/auth/register', { username, password });
  return res;
}

export async function login(username, password) {
  const res = await post('/api/v1/auth/login', { username, password });
  if (res.token) setToken(res.token);
  return res;
}

export function logout() {
  setToken('');
}

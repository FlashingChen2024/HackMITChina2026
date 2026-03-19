/**
 * v4.0 鉴权：注册、登录、JWT 校验
 * @module services/authService
 */

const db = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'mit-lunchbox-v4-secret';
const SALT_ROUNDS = 10;

/**
 * 用户注册
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ user_id: string, message: string }>}
 */
async function register(username, password) {
  if (!username || typeof username !== 'string' || !password || typeof password !== 'string') {
    throw new Error('username 与 password 必填');
  }
  const name = username.trim();
  if (name.length < 1) throw new Error('username 不能为空');
  const hash = await bcrypt.hash(password, SALT_ROUNDS);
  try {
    const result = await db.query(
      'INSERT INTO Users (username, password_hash) VALUES (?, ?)',
      [name, hash]
    );
    const insertId = result && (result.insertId != null ? result.insertId : (Array.isArray(result) ? result[0] : null)?.insertId);
    const userId = insertId != null ? String(insertId) : '';
    return { user_id: userId, message: 'register success' };
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY' || (e.message && e.message.includes('Duplicate'))) {
      throw new Error('用户名已存在');
    }
    throw e;
  }
}

/**
 * 用户登录，返回 JWT
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{ token: string, user_id: string, username: string }>}
 */
async function login(username, password) {
  if (!username || !password) throw new Error('username 与 password 必填');
  const rows = await db.query(
    'SELECT id, username, password_hash FROM Users WHERE username = ? LIMIT 1',
    [username.trim()]
  );
  const u = rows && rows[0] ? rows[0] : null;
  if (!u) throw new Error('用户不存在');
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw new Error('密码错误');
  const payload = { userId: Number(u.id), username: u.username };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
  return {
    token,
    user_id: String(u.id),
    username: u.username
  };
}

/**
 * 校验 JWT，返回 payload
 * @param {string} token - Bearer xxx 或纯 token
 * @returns {{ userId: number, username: string }|null}
 */
function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const t = token.replace(/^Bearer\s+/i, '').trim();
  if (!t) return null;
  try {
    const payload = jwt.verify(t, JWT_SECRET);
    return { userId: payload.userId, username: payload.username };
  } catch (_) {
    return null;
  }
}

module.exports = {
  register,
  login,
  verifyToken,
  JWT_SECRET
};

/**
 * v4.0 鉴权中间件：除 ping、telemetry、auth/register、auth/login 外均需 Bearer Token
 * @module middleware/auth
 */

const { verifyToken } = require('../services/authService');

/**
 * 要求请求头带 Authorization: Bearer <token>，校验通过后设置 req.user = { userId, username }
 */
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  const user = verifyToken(auth);
  if (!user) {
    return res.status(401).json({ error: 'unauthorized', message: '缺少或无效的 Token' });
  }
  req.user = user;
  next();
}

module.exports = { requireAuth };

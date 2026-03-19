/**
 * 设备-用户绑定服务（方案 A Step 2）
 * 供 telemetry 结算与 GET /meals 通过 device_id 查 user_id
 * @module services/deviceBindingService
 */

const db = require('../config/db');

/**
 * 根据 device_id 查询绑定的 user_id
 * @param {string} deviceId - 设备 MAC 或唯一标识
 * @returns {Promise<number|null>} 用户 ID，未绑定返回 null
 */
async function getUserIdByDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return null;
  const rows = await db.query(
    'SELECT user_id FROM Device_User_Binding WHERE device_id = ? LIMIT 1',
    [deviceId.trim()]
  );
  return rows && rows[0] ? Number(rows[0].user_id) : null;
}

/**
 * 绑定设备与用户（存在则更新 user_id）
 * @param {string} deviceId - 设备标识
 * @param {number} userId - 用户 ID
 * @returns {Promise<{ device_id: string, user_id: number }>}
 */
async function bind(deviceId, userId) {
  if (!deviceId || typeof deviceId !== 'string') {
    throw new Error('device_id 必填且为字符串');
  }
  const uid = Number(userId);
  if (!Number.isInteger(uid) || uid < 1) {
    throw new Error('user_id 必填且为正整数');
  }
  const did = deviceId.trim();
  await db.query(
    `INSERT INTO Device_User_Binding (device_id, user_id) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), updated_at = CURRENT_TIMESTAMP`,
    [did, uid]
  );
  return { device_id: did, user_id: uid };
}

/**
 * 解除设备绑定
 * @param {string} deviceId - 设备标识
 * @returns {Promise<boolean>} 是否删除了记录
 */
async function unbind(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return false;
  const raw = await db.query(
    'DELETE FROM Device_User_Binding WHERE device_id = ?',
    [deviceId.trim()]
  );
  const result = Array.isArray(raw) ? raw[0] : raw;
  return result && typeof result.affectedRows === 'number' && result.affectedRows > 0;
}

/**
 * 查询某用户下已绑定的设备列表
 * @param {number} userId - 用户 ID
 * @returns {Promise<Array<{ device_id: string, user_id: number, created_at: Date }>>}
 */
async function listByUserId(userId) {
  const uid = Number(userId);
  if (!Number.isInteger(uid)) return [];
  const rows = await db.query(
    'SELECT device_id, user_id, created_at FROM Device_User_Binding WHERE user_id = ? ORDER BY created_at DESC',
    [uid]
  );
  return rows || [];
}

/**
 * 根据 device_id 查询绑定记录（含 user_id 与时间）
 * @param {string} deviceId
 * @returns {Promise<object|null>} { device_id, user_id, created_at, updated_at }
 */
async function getBindingByDeviceId(deviceId) {
  if (!deviceId || typeof deviceId !== 'string') return null;
  const rows = await db.query(
    'SELECT device_id, user_id, created_at, updated_at FROM Device_User_Binding WHERE device_id = ? LIMIT 1',
    [deviceId.trim()]
  );
  return rows && rows[0] ? rows[0] : null;
}

module.exports = {
  getUserIdByDeviceId,
  bind,
  unbind,
  listByUserId,
  getBindingByDeviceId
};

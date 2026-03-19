/**
 * 社区服务：创建社区、加入社区、查看社区、管理我的社区
 * @module services/communityService
 */

const db = require('../config/db');

/**
 * 生成社区 ID（示例：C8F3A1B2）
 * @returns {string}
 */
function generateCommunityId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let s = 'C';
  for (let i = 0; i < 7; i += 1) {
    const idx = Math.floor(Math.random() * chars.length);
    s += chars[idx];
  }
  return s;
}

/**
 * 创建社区，并自动把创建者加入社区（owner）
 * @param {number} ownerUserId
 * @param {string} name
 * @param {string} [description]
 * @returns {Promise<{ community_id: string, message: string }>}
 */
async function createCommunity(ownerUserId, name, description = '') {
  const uid = Number(ownerUserId);
  const cname = String(name || '').trim();
  const desc = String(description || '').trim();
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');
  if (!cname) throw new Error('name is required');

  let communityId = '';
  // 避免极小概率冲突，重试 5 次
  for (let i = 0; i < 5; i += 1) {
    communityId = generateCommunityId();
    const exists = await db.query(
      'SELECT 1 FROM Communities WHERE community_id = ? LIMIT 1',
      [communityId]
    );
    if (!exists || exists.length === 0) break;
    communityId = '';
  }
  if (!communityId) throw new Error('failed to allocate community id');

  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute(
      'INSERT INTO Communities (community_id, owner_user_id, name, description, status) VALUES (?, ?, ?, ?, 1)',
      [communityId, uid, cname, desc || null]
    );
    await conn.execute(
      'INSERT INTO Community_Members (community_id, user_id, role) VALUES (?, ?, ?)',
      [communityId, uid, 'owner']
    );
    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  return { community_id: communityId, message: '创建成功' };
}

/**
 * 通过社区 ID 加入社区
 * @param {number} userId
 * @param {string} communityId
 * @returns {Promise<{ message: string }>}
 */
async function joinCommunity(userId, communityId) {
  const uid = Number(userId);
  const cid = String(communityId || '').trim().toUpperCase();
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');
  if (!cid) throw new Error('community_id is required');

  const rows = await db.query(
    'SELECT community_id, status FROM Communities WHERE community_id = ? LIMIT 1',
    [cid]
  );
  if (!rows || rows.length === 0) throw new Error('community not found');
  if (Number(rows[0].status) !== 1) throw new Error('community is inactive');

  await db.query(
    'INSERT IGNORE INTO Community_Members (community_id, user_id, role) VALUES (?, ?, ?)',
    [cid, uid, 'member']
  );
  return { message: '加入成功' };
}

/**
 * 查看我加入的社区
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function listMyCommunities(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');

  const rows = await db.query(
    `SELECT c.community_id, c.name, c.description, c.owner_user_id, c.created_at, cm.role,
            (SELECT COUNT(1) FROM Community_Members m WHERE m.community_id = c.community_id) AS member_count
       FROM Community_Members cm
       JOIN Communities c ON c.community_id = cm.community_id
      WHERE cm.user_id = ? AND c.status = 1
      ORDER BY c.created_at DESC`,
    [uid]
  );
  return rows || [];
}

/**
 * 查看我创建的社区（管理视图）
 * @param {number} userId
 * @returns {Promise<Array>}
 */
async function listOwnedCommunities(userId) {
  const uid = Number(userId);
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');
  const rows = await db.query(
    `SELECT c.community_id, c.name, c.description, c.created_at,
            (SELECT COUNT(1) FROM Community_Members m WHERE m.community_id = c.community_id) AS member_count
       FROM Communities c
      WHERE c.owner_user_id = ? AND c.status = 1
      ORDER BY c.created_at DESC`,
    [uid]
  );
  return rows || [];
}

/**
 * 更新我创建的社区（名称、简介）
 * @param {number} userId
 * @param {string} communityId
 * @param {{ name?: string, description?: string }} payload
 * @returns {Promise<{ message: string }>}
 */
async function updateOwnedCommunity(userId, communityId, payload = {}) {
  const uid = Number(userId);
  const cid = String(communityId || '').trim().toUpperCase();
  const name = payload.name != null ? String(payload.name).trim() : '';
  const description = payload.description != null ? String(payload.description).trim() : '';
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');
  if (!cid) throw new Error('community_id is required');
  if (!name) throw new Error('name is required');

  const result = await db.query(
    `UPDATE Communities
        SET name = ?, description = ?
      WHERE community_id = ? AND owner_user_id = ? AND status = 1`,
    [name, description || null, cid, uid]
  );
  if (!result || result.affectedRows < 1) throw new Error('community not found or no permission');
  return { message: '更新成功' };
}

/**
 * 解散我创建的社区（软删除）
 * @param {number} userId
 * @param {string} communityId
 * @returns {Promise<{ message: string }>}
 */
async function dissolveOwnedCommunity(userId, communityId) {
  const uid = Number(userId);
  const cid = String(communityId || '').trim().toUpperCase();
  if (!Number.isFinite(uid) || uid < 1) throw new Error('invalid user');
  if (!cid) throw new Error('community_id is required');

  const result = await db.query(
    'UPDATE Communities SET status = 0 WHERE community_id = ? AND owner_user_id = ? AND status = 1',
    [cid, uid]
  );
  if (!result || result.affectedRows < 1) throw new Error('community not found or no permission');
  return { message: '社区已解散' };
}

module.exports = {
  createCommunity,
  joinCommunity,
  listMyCommunities,
  listOwnedCommunities,
  updateOwnedCommunity,
  dissolveOwnedCommunity
};


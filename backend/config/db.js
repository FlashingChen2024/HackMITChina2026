/**
 * 数据库连接配置
 * @module config/db
 */

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'diet_tracking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

/**
 * 获取连接池（用于查询）
 * @returns {import('mysql2/promise').Pool}
 */
function getPool() {
  return pool;
}

/**
 * 执行单条 SQL（带参数）
 * @param {string} sql
 * @param {Array} [params]
 * @returns {Promise<[import('mysql2').ResultSetHeader, import('mysql2').FieldPacket[]]>}
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

module.exports = { getPool, query, pool };

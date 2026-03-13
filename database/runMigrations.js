#!/usr/bin/env node
/**
 * 数据库迁移执行脚本
 * 按顺序执行 database/migrations/*.sql
 * 使用方式: npm run migrate（需配置 .env 中的 DB_*）
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

const MIGRATIONS_DIR = path.join(__dirname, 'migrations');

async function run() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'diet_tracking',
    multipleStatements: true
  });

  const files = fs.readdirSync(MIGRATIONS_DIR).filter(f => f.endsWith('.sql')).sort();
  for (const file of files) {
    const filePath = path.join(MIGRATIONS_DIR, file);
    const sql = fs.readFileSync(filePath, 'utf8');
    console.log(`Running migration: ${file}`);
    await connection.query(sql);
    console.log(`  OK: ${file}`);
  }
  await connection.end();
  console.log('All migrations completed.');
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});

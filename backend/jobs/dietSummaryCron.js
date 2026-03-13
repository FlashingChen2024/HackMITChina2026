/**
 * 每日饮食数据汇总定时任务
 * 每天凌晨 0 点执行，汇总前一天的 Meal_Records 到 Daily_Diet_Summary
 * @module jobs/dietSummaryCron
 */

const cron = require('node-cron');
const { runDailySummary } = require('../services/dietSummaryService');
require('dotenv').config();

const CRON_EXPRESSION = '0 0 * * *'; // 每天 00:00
const ENABLED = process.env.CRON_DAILY_SUMMARY_ENABLED !== '0';

/**
 * 执行一次汇总并打印结果
 */
async function runOnce() {
  const ts = new Date().toISOString();
  console.log(`[${ts}] 开始执行每日饮食数据汇总任务...`);
  try {
    const result = await runDailySummary();
    console.log(`[${ts}] 汇总完成，日期: ${result.date}, 处理用户数: ${result.userCount}`);
    if (result.error) {
      console.error(`[${ts}] 错误:`, result.error);
    }
  } catch (error) {
    console.error(`[${ts}] 汇总任务执行失败:`, error);
  }
}

if (ENABLED) {
  cron.schedule(CRON_EXPRESSION, runOnce, {
    scheduled: true,
    timezone: 'Asia/Shanghai'
  });
  console.log('定时任务已注册: 每天 00:00 (Asia/Shanghai) 执行每日饮食汇总');
  runOnce().catch(() => {});
} else {
  console.log('CRON_DAILY_SUMMARY_ENABLED=0，定时任务未启用');
}

module.exports = { runOnce };

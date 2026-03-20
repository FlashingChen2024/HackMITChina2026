/**
 * Prompt 服务单元测试（阶段三 5-3-1）
 * 运行: node --test backend/services/promptService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  generatePrompt,
  generateDailyPrompt,
  generateWeeklyPrompt,
  replacePlaceholders,
  PROMPT_VERSION
} = require('./promptService');

describe('promptService', () => {
  describe('replacePlaceholders', () => {
    it('应替换所有占位符', () => {
      const out = replacePlaceholders('a {x} b {y} c', { x: '1', y: '2' });
      assert.strictEqual(out, 'a 1 b 2 c');
    });
    it('null/undefined 替换为「未知」', () => {
      const out = replacePlaceholders('{a} {b}', { a: null, b: undefined });
      assert.strictEqual(out, '未知 未知');
    });
  });

  describe('generateDailyPrompt', () => {
    it('应包含用户与日期', () => {
      const p = generateDailyPrompt({ userId: 99, date: '2024-03-08' });
      assert.ok(p.includes('99'));
      assert.ok(p.includes('2024-03-08'));
    });
    it('应包含打饭量、摄入量等占位替换', () => {
      const p = generateDailyPrompt({
        userId: 1,
        date: '2024-03-08',
        total_initial_weight: 400,
        total_intake_weight: 350,
        total_remaining_weight: 50
      });
      assert.ok(p.includes('400'));
      assert.ok(p.includes('350'));
      assert.ok(p.includes('50'));
    });
  });

  describe('generateWeeklyPrompt', () => {
    it('应包含周期与汇总', () => {
      const p = generateWeeklyPrompt({
        userId: 1,
        startDate: '2024-03-01',
        endDate: '2024-03-07',
        avg_daily_intake: 300,
        avg_waste_rate: 10
      });
      assert.ok(p.includes('2024-03-01'));
      assert.ok(p.includes('2024-03-07'));
      assert.ok(p.includes('300'));
    });
  });

  describe('generatePrompt', () => {
    it('daily_report 返回 prompt 与 version', () => {
      const { prompt, version } = generatePrompt('daily_report', { userId: 1, date: '2024-03-08' });
      assert.ok(prompt.length > 0);
      assert.strictEqual(version, PROMPT_VERSION);
    });
    it('weekly_report 返回 prompt 与 version', () => {
      const { prompt, version } = generatePrompt('weekly_report', {
        userId: 1,
        startDate: '2024-03-01',
        endDate: '2024-03-07'
      });
      assert.ok(prompt.length > 0);
      assert.strictEqual(version, PROMPT_VERSION);
    });
    it('未知类型应抛错', () => {
      assert.throws(() => generatePrompt('unknown', {}), /未知模板类型/);
    });
  });
});

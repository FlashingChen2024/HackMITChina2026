/**
 * 诊断服务单元测试（阶段三 5-3-2）
 * 运行: node --test backend/services/diagnosisService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  diagnoseDietIssues,
  formatDiagnosisForPrompt,
  calcWasteRate
} = require('./diagnosisService');

describe('diagnosisService', () => {
  describe('calcWasteRate', () => {
    it('打饭 400 剩余 80 应为 20%', () => {
      assert.strictEqual(calcWasteRate(400, 80), 20);
    });
    it('打饭 0 应返回 0', () => {
      assert.strictEqual(calcWasteRate(0, 50), 0);
    });
  });

  describe('diagnoseDietIssues', () => {
    it('浪费率 >20% 应产生 high_waste issue', () => {
      const r = diagnoseDietIssues(
        { total_initial_weight: 400, total_remaining_weight: 100, total_intake_weight: 300, avg_eating_speed: 30 },
        {}
      );
      assert.ok(r.issues.some(i => i.type === 'high_waste'));
    });
    it('浪费率 15~20% 应产生 moderate_waste warning', () => {
      const r = diagnoseDietIssues(
        { total_initial_weight: 400, total_remaining_weight: 70, total_intake_weight: 330, avg_eating_speed: 25 },
        {}
      );
      assert.ok(r.warnings.some(w => w.type === 'moderate_waste'));
    });
    it('摄入量低于均值 80% 应产生 low_intake issue', () => {
      const r = diagnoseDietIssues(
        { total_initial_weight: 400, total_remaining_weight: 20, total_intake_weight: 200, avg_eating_speed: 20 },
        { avg_daily_intake: 350 }
      );
      assert.ok(r.issues.some(i => i.type === 'low_intake'));
    });
    it('用餐速度 >50 应产生 fast_eating warning', () => {
      const r = diagnoseDietIssues(
        { total_initial_weight: 400, total_remaining_weight: 20, total_intake_weight: 380, avg_eating_speed: 60 },
        {}
      );
      assert.ok(r.warnings.some(w => w.type === 'fast_eating'));
    });
    it('无异常时 issues 与 warnings 可为空或较少', () => {
      const r = diagnoseDietIssues(
        { total_initial_weight: 400, total_remaining_weight: 20, total_intake_weight: 380, avg_eating_speed: 25 },
        { avg_daily_intake: 350 }
      );
      assert.ok(Array.isArray(r.issues));
      assert.ok(Array.isArray(r.warnings));
    });
  });

  describe('formatDiagnosisForPrompt', () => {
    it('无 issues/warnings 返回空串', () => {
      assert.strictEqual(formatDiagnosisForPrompt({ issues: [], warnings: [] }), '');
    });
    it('有 issue 时应包含 message', () => {
      const text = formatDiagnosisForPrompt({
        issues: [{ message: '浪费率过高', suggestion: '减少打饭' }],
        warnings: []
      });
      assert.ok(text.includes('浪费率过高'));
      assert.ok(text.includes('减少打饭'));
    });
  });
});

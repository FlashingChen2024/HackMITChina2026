/**
 * AI 分析服务单元测试（阶段三 5-3-3）：校验与解析逻辑
 * 运行: node --test backend/services/aiAnalysisService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');
const {
  validateAnalysisResult,
  extractJsonFromResponse,
  generateFallbackReport
} = require('./aiAnalysisService');
const { diagnoseDietIssues } = require('./diagnosisService');

describe('aiAnalysisService', () => {
  const validResult = {
    diet_evaluation: '良好',
    improvement_measures: ['建议1'],
    next_week_goals: ['目标1'],
    nutrition_score: 80,
    waste_score: 85,
    speed_score: 75
  };

  describe('validateAnalysisResult', () => {
    it('合法对象应通过', () => {
      assert.doesNotThrow(() => validateAnalysisResult(validResult));
    });
    it('缺少必填字段应抛错', () => {
      const bad = { ...validResult };
      delete bad.diet_evaluation;
      assert.throws(() => validateAnalysisResult(bad), /缺少必需字段/);
    });
    it('分数超出 0-100 应抛错', () => {
      assert.throws(() => validateAnalysisResult({ ...validResult, nutrition_score: 101 }), /0-100/);
      assert.throws(() => validateAnalysisResult({ ...validResult, waste_score: -1 }), /0-100/);
    });
    it('improvement_measures 非数组应抛错', () => {
      assert.throws(
        () => validateAnalysisResult({ ...validResult, improvement_measures: 'x' }),
        /improvement_measures/
      );
    });
    it('null 或非对象应抛错', () => {
      assert.throws(() => validateAnalysisResult(null), /必须为对象/);
    });
  });

  describe('extractJsonFromResponse', () => {
    it('纯 JSON 应解析成功', () => {
      const obj = extractJsonFromResponse('{"a":1}');
      assert.strictEqual(obj.a, 1);
    });
    it('前后有文字应提取 JSON', () => {
      const obj = extractJsonFromResponse('以下是结果：\n{"b":2}\n结束');
      assert.strictEqual(obj.b, 2);
    });
    it('空内容应抛错', () => {
      assert.throws(() => extractJsonFromResponse(''), /为空/);
    });
    it('无 JSON 应抛错', () => {
      assert.throws(() => extractJsonFromResponse('no json here'), /未找到/);
    });
  });

  describe('generateFallbackReport', () => {
    it('应返回含必填字段且分数在 0-100', () => {
      const summary = {
        total_initial_weight: 400,
        total_remaining_weight: 60,
        total_intake_weight: 340,
        avg_eating_speed: 35
      };
      const diagnosis = diagnoseDietIssues(summary, {});
      const report = generateFallbackReport(summary, diagnosis, 'daily');
      assert.ok(report.diet_evaluation);
      assert.ok(Array.isArray(report.improvement_measures));
      assert.ok(Array.isArray(report.next_week_goals));
      assert.ok(report.nutrition_score >= 0 && report.nutrition_score <= 100);
      assert.ok(report.waste_score >= 0 && report.waste_score <= 100);
      assert.ok(report.speed_score >= 0 && report.speed_score <= 100);
    });
  });
});

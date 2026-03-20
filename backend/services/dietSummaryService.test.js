/**
 * 数据汇总服务单元测试
 * 执行清单：数据汇总算法单元测试
 * 运行: node --test backend/services/dietSummaryService.test.js
 */

const { describe, it } = require('node:test');
const assert = require('node:assert');

/**
 * 纯逻辑：根据记录列表计算汇总字段（不依赖数据库）
 * 与 dietSummaryService 中汇总算法保持一致，便于单测
 */
function computeSummaryFromRecords(records) {
  let totalInitialWeight = 0;
  let totalRemainingWeight = 0;
  let totalIntakeWeight = 0;
  let totalCalories = 0;
  let fastestMealDuration = null;
  let slowestMealDuration = null;
  let totalSpeed = 0;
  let speedCount = 0;

  for (const r of records) {
    totalInitialWeight += Number(r.initial_weight) || 0;
    totalRemainingWeight += Number(r.remaining_weight) || 0;
    totalIntakeWeight += Number(r.intake_weight) || 0;
    totalCalories += Number(r.total_calories) || 0;

    const duration = r.eating_duration != null ? Number(r.eating_duration) : null;
    if (duration != null) {
      if (fastestMealDuration == null || duration < fastestMealDuration) {
        fastestMealDuration = duration;
      }
      if (slowestMealDuration == null || duration > slowestMealDuration) {
        slowestMealDuration = duration;
      }
    }
    if (r.eating_speed != null) {
      totalSpeed += Number(r.eating_speed);
      speedCount += 1;
    }
  }

  const avgEatingSpeed = speedCount > 0 ? totalSpeed / speedCount : 0;
  return {
    total_initial_weight: totalInitialWeight,
    total_remaining_weight: totalRemainingWeight,
    total_intake_weight: totalIntakeWeight,
    total_calories: totalCalories,
    meal_count: records.length,
    fastest_meal_duration: fastestMealDuration,
    slowest_meal_duration: slowestMealDuration,
    avg_eating_speed: avgEatingSpeed
  };
}

describe('dietSummaryService - 汇总算法', () => {
  it('空记录应得到 0 与 null', () => {
    const out = computeSummaryFromRecords([]);
    assert.strictEqual(out.meal_count, 0);
    assert.strictEqual(out.total_intake_weight, 0);
    assert.strictEqual(out.avg_eating_speed, 0);
    assert.strictEqual(out.fastest_meal_duration, null);
    assert.strictEqual(out.slowest_meal_duration, null);
  });

  it('单条记录汇总正确', () => {
    const records = [
      {
        initial_weight: 400,
        remaining_weight: 50,
        intake_weight: 350,
        eating_duration: 600,
        eating_speed: 35,
        total_calories: 520
      }
    ];
    const out = computeSummaryFromRecords(records);
    assert.strictEqual(out.total_initial_weight, 400);
    assert.strictEqual(out.total_remaining_weight, 50);
    assert.strictEqual(out.total_intake_weight, 350);
    assert.strictEqual(out.total_calories, 520);
    assert.strictEqual(out.meal_count, 1);
    assert.strictEqual(out.fastest_meal_duration, 600);
    assert.strictEqual(out.slowest_meal_duration, 600);
    assert.strictEqual(out.avg_eating_speed, 35);
  });

  it('多条记录取最快最慢时长与平均速度', () => {
    const records = [
      { eating_duration: 300, eating_speed: 60, initial_weight: 300, remaining_weight: 0, intake_weight: 300, total_calories: 400 },
      { eating_duration: 900, eating_speed: 20, initial_weight: 400, remaining_weight: 50, intake_weight: 350, total_calories: 500 }
    ];
    const out = computeSummaryFromRecords(records);
    assert.strictEqual(out.fastest_meal_duration, 300);
    assert.strictEqual(out.slowest_meal_duration, 900);
    assert.strictEqual(out.avg_eating_speed, 40);
    assert.strictEqual(out.total_intake_weight, 650);
    assert.strictEqual(out.meal_count, 2);
  });
});

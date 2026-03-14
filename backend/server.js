/**
 * 模块5 后端入口
 * 提供 HTTP 服务，并可选挂载定时任务
 */

const express = require('express');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

/** 健康检查 */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'module5-diet-tracking' });
});

/** 手动触发每日汇总（便于测试），例如 POST /api/diet/summary/run */
app.post('/api/diet/summary/run', async (req, res) => {
  try {
    const { runDailySummary } = require('./services/dietSummaryService');
    const date = req.body && req.body.date ? req.body.date : undefined;
    const result = await runDailySummary(date);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 导入 Mock 用餐记录（便于图表/日报有数据）POST /api/diet/seed/meal_records */
app.post('/api/diet/seed/meal_records', async (req, res) => {
  try {
    const { insertMealRecords } = require('./services/seedService');
    const body = req.body || {};
    const records = body.records;
    if (!Array.isArray(records)) {
      return res.status(400).json({ code: 400, message: '缺少 body.records 数组' });
    }
    const result = await insertMealRecords(records);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 生成饮食分析报告（日报）POST /api/diet/analysis/generate */
app.post('/api/diet/analysis/generate', async (req, res) => {
  try {
    const { generateDietAnalysis } = require('./services/aiAnalysisService');
    const body = req.body || {};
    const userId = Number(body.user_id);
    const date = body.date; // YYYY-MM-DD
    const reportType = body.report_type === 'weekly' ? 'weekly' : 'daily';
    const forceFallback = body.force_fallback === true;
    if (!userId || !date) {
      return res.status(400).json({ code: 400, message: '缺少 user_id 或 date' });
    }
    const result = await generateDietAnalysis(userId, date, reportType, { forceFallback });
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 查询已有分析报告 GET /api/diet/analysis/report?user_id=1&date=2024-03-08&report_type=1 */
app.get('/api/diet/analysis/report', async (req, res) => {
  try {
    const { getAnalysisReport } = require('./services/aiAnalysisService');
    const userId = Number(req.query.user_id);
    const date = req.query.date;
    const reportType = req.query.report_type != null ? Number(req.query.report_type) : undefined;
    if (!userId || !date) {
      return res.status(400).json({ code: 400, message: '缺少 user_id 或 date' });
    }
    const report = await getAnalysisReport(userId, date, reportType);
    if (!report) {
      return res.json({ code: 200, data: null });
    }
    res.json({ code: 200, data: report });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 个性化饮食建议（基于最近报告与诊断）GET /api/diet/recommendations?user_id=1 */
app.get('/api/diet/recommendations', async (req, res) => {
  try {
    const { getPersonalizedRecommendations } = require('./services/recommendationService');
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少 user_id' });
    }
    const list = await getPersonalizedRecommendations(userId);
    res.json({ code: 200, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 阶段二：统计图表数据 GET /api/diet/statistics/charts?user_id=1&start_date=2024-03-01&end_date=2024-03-08&chart_type=daily_trend */
app.get('/api/diet/statistics/charts', async (req, res) => {
  try {
    const { getChartData } = require('./services/chartsService');
    const userId = Number(req.query.user_id);
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const chartType = req.query.chart_type || 'daily_trend';
    if (!userId || !startDate || !endDate) {
      return res.status(400).json({ code: 400, message: '缺少 user_id、start_date 或 end_date' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ code: 400, message: 'start_date 不能大于 end_date' });
    }
    const data = await getChartData(userId, startDate, endDate, chartType);
    res.json({ code: 200, data });
  } catch (err) {
    console.error(err);
    const status = err.message && err.message.includes('不支持的') ? 400 : 500;
    res.status(status).json({ code: status, message: err.message });
  }
});

// ---------- 新 API 规范（Base /api/v1） ----------

/** 健康检查 GET /api/v1/ping */
app.get('/api/v1/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

/** 硬件遥测上报 POST /api/v1/hardware/telemetry  body: { device_id, weight_g [, timestamp ] }，返回 state */
app.post('/api/v1/hardware/telemetry', async (req, res) => {
  try {
    const { processTelemetry } = require('./services/telemetryService');
    const { parseToUnixSeconds } = require('./utils/time');
    const body = req.body || {};
    const deviceId = body.device_id;
    const weightG = body.weight_g;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'invalid request body' });
    }
    if (weightG == null || (typeof weightG !== 'number' && typeof weightG !== 'string')) {
      return res.status(400).json({ error: 'invalid request body' });
    }
    const w = Number(weightG);
    if (!Number.isFinite(w)) {
      return res.status(400).json({ error: 'invalid request body' });
    }
    let tsUnix = Math.floor(Date.now() / 1000);
    if (body.timestamp != null && body.timestamp !== '') {
      const parsed = parseToUnixSeconds(body.timestamp);
      if (!parsed.ok) {
        return res.status(400).json({ error: parsed.error });
      }
      tsUnix = parsed.unix;
    }
    const result = await processTelemetry(deviceId, tsUnix, w);
    res.status(200).json({
      device_id: deviceId,
      previous_state: result.previous_state,
      current_state: result.current_state,
      timestamp: result.timestamp
    });
  } catch (err) {
    console.error('[telemetry]', err);
    res.status(500).json({ error: 'process telemetry failed' });
  }
});

/** 绑定设备与用户 POST /api/v1/devices/bindings  body: { device_id, user_id } */
app.post('/api/v1/devices/bindings', async (req, res) => {
  try {
    const { bind } = require('./services/deviceBindingService');
    const body = req.body || {};
    const deviceId = body.device_id;
    const userId = body.user_id;
    if (!deviceId || userId == null) {
      return res.status(400).json({ code: 400, message: '缺少 device_id 或 user_id' });
    }
    const result = await bind(deviceId, userId);
    res.status(200).json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(400).json({ code: 400, message: err.message });
  }
});

/** 查询单个设备绑定 GET /api/v1/devices/bindings/:device_id（须在无参 GET 之前） */
app.get('/api/v1/devices/bindings/:device_id', async (req, res) => {
  try {
    const { getBindingByDeviceId } = require('./services/deviceBindingService');
    const deviceId = req.params.device_id;
    const binding = await getBindingByDeviceId(deviceId);
    if (!binding) {
      return res.status(404).json({ code: 404, message: '未找到该设备绑定' });
    }
    res.json({ code: 200, data: binding });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 按用户查询已绑定设备 GET /api/v1/devices/bindings?user_id=1 */
app.get('/api/v1/devices/bindings', async (req, res) => {
  try {
    const { listByUserId } = require('./services/deviceBindingService');
    const userId = Number(req.query.user_id);
    if (!userId) {
      return res.status(400).json({ code: 400, message: '缺少 user_id' });
    }
    const list = await listByUserId(userId);
    res.json({ code: 200, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 解除设备绑定 DELETE /api/v1/devices/bindings/:device_id */
app.delete('/api/v1/devices/bindings/:device_id', async (req, res) => {
  try {
    const { unbind } = require('./services/deviceBindingService');
    const deviceId = req.params.device_id;
    const removed = await unbind(deviceId);
    if (!removed) {
      return res.status(404).json({ code: 404, message: '未找到该设备绑定' });
    }
    res.status(200).json({ code: 200, message: '已解除绑定' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 历史用餐列表（游标分页）GET /api/v1/meals?cursor=&limit= */
app.get('/api/v1/meals', async (req, res) => {
  try {
    const { listMeals } = require('./services/mealsService');
    const cursor = req.query.cursor;
    const limit = req.query.limit;
    const result = await listMeals(cursor, limit);
    res.json(result);
  } catch (err) {
    console.error(err);
    const isCursorError = err.message && (err.message.includes('RFC3339') || err.message.includes('unix seconds'));
    if (isCursorError) {
      return res.status(400).json({ error: 'cursor must be RFC3339 or unix seconds' });
    }
    res.status(500).json({ error: 'list meals failed' });
  }
});

/** 就餐时序轨迹 GET /api/v1/meals/:meal_id/trajectory（须在 /meals/:meal_id 之前注册） */
app.get('/api/v1/meals/:meal_id/trajectory', async (req, res) => {
  try {
    const { getMealTrajectory } = require('./services/mealsService');
    const { parseToUnixSeconds } = require('./utils/time');
    const mealId = req.params.meal_id;
    let lastTimestamp = req.query.last_timestamp;
    const sampleInterval = req.query.sample_interval;
    if (lastTimestamp != null && lastTimestamp !== '') {
      const parsed = parseToUnixSeconds(lastTimestamp);
      if (!parsed.ok) {
        return res.status(400).json({ error: 'last_timestamp must be RFC3339 or unix seconds' });
      }
    }
    if (sampleInterval != null && sampleInterval !== '') {
      const n = Number(sampleInterval);
      if (!Number.isInteger(n) || n < 1) {
        return res.status(400).json({ error: 'sample_interval must be a positive integer' });
      }
    }
    const result = await getMealTrajectory(mealId, lastTimestamp, sampleInterval);
    res.json(result);
  } catch (err) {
    console.error(err);
    const isParamError = err.message && (err.message.includes('RFC3339') || err.message.includes('unix seconds') || err.message.includes('positive integer'));
    if (isParamError) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'get meal trajectory failed' });
  }
});

/** 单次用餐详情 GET /api/v1/meals/:meal_id */
app.get('/api/v1/meals/:meal_id', async (req, res) => {
  try {
    const { getMealDetail } = require('./services/mealsService');
    const mealId = req.params.meal_id;
    const detail = await getMealDetail(mealId);
    if (!detail) {
      return res.status(404).json({ error: 'meal not found' });
    }
    res.json(detail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'get meal failed' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

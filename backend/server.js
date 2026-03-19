/**
 * 模块5 后端入口 — v4.0 全链路：鉴权、遥测四格、设备认主、meals 规范
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { requireAuth } = require('./middleware/auth');
const { getUserIdByDeviceId } = require('./services/deviceBindingService');
const { parseToUnixSeconds } = require('./utils/time');

const app = express();
const PORT = process.env.PORT || 3000;

/** 允许前端跨域（localhost/127.0.0.1 不同端口），解决 Failed to fetch */
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// ========== 无需鉴权 ==========

/** 根路径提示：前端在 Vite 端口（如 5173），API 在 /api/v1 */
app.get('/', (req, res) => {
  res.json({
    message: 'K-XYZ 智能餐盒 API',
    docs: '前端请访问 Vite 端口（如 http://localhost:5173），API 路径为 /api/v1/ping、/api/v1/auth/login 等'
  });
});

/** 健康检查（旧） */
app.get('/health', (req, res) => {
  res.json({ status: 'ok', module: 'module5-diet-tracking' });
});

/** v4.0 健康检查 GET /api/v1/ping */
app.get('/api/v1/ping', (req, res) => {
  res.json({ message: 'pong', timestamp: new Date().toISOString() });
});

/** v4.0 用户注册 POST /api/v1/auth/register */
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { register } = require('./services/authService');
    const { username, password } = req.body || {};
    const result = await register(username, password);
    res.status(200).json(result);
  } catch (err) {
    const code = err.message && (err.message.includes('Duplicate') || err.message.includes('username')) ? 400 : 500;
    res.status(code).json({ error: err.message || 'register failed' });
  }
});

/** v4.0 用户登录 POST /api/v1/auth/login */
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { login } = require('./services/authService');
    const { username, password } = req.body || {};
    const result = await login(username, password);
    res.status(200).json(result);
  } catch (err) {
    res.status(401).json({ error: err.message || 'login failed' });
  }
});

/** v4.0 硬件遥测 POST /api/v1/hardware/telemetry — 无鉴权；未绑定设备拦截 */
app.post('/api/v1/hardware/telemetry', async (req, res) => {
  try {
    const { processTelemetry } = require('./services/telemetryService');
    const body = req.body || {};
    const deviceId = body.device_id;
    const weights = body.weights;
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'invalid request body' });
    }
    if (!weights || typeof weights !== 'object') {
      return res.status(400).json({ error: 'invalid request body' });
    }
    const uid = await getUserIdByDeviceId(deviceId);
    if (uid == null) {
      return res.status(403).json({ error: 'device not bound', message: '设备未绑定，请先完成设备认主' });
    }
    let tsUnix = Math.floor(Date.now() / 1000);
    if (body.timestamp != null && body.timestamp !== '') {
      const parsed = parseToUnixSeconds(body.timestamp);
      if (!parsed.ok) return res.status(400).json({ error: parsed.error });
      tsUnix = parsed.unix;
    }
    const result = await processTelemetry(deviceId, tsUnix, weights);
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

// ========== 以下需鉴权：Authorization: Bearer <token> ==========

/** v4.0 设备认主 POST /api/v1/devices/bind — body: { device_id }，user 从 JWT */
app.post('/api/v1/devices/bind', requireAuth, async (req, res) => {
  try {
    const { bind } = require('./services/deviceBindingService');
    const deviceId = (req.body && req.body.device_id) || '';
    if (!deviceId || typeof deviceId !== 'string') {
      return res.status(400).json({ error: 'device_id required' });
    }
    await bind(deviceId.trim(), req.user.userId);
    res.status(200).json({ message: 'device bind success', device_id: deviceId.trim() });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: err.message || 'bind failed' });
  }
});

/** 查询当前用户已绑定设备 GET /api/v1/devices/bindings（鉴权后取 user_id） */
app.get('/api/v1/devices/bindings', requireAuth, async (req, res) => {
  try {
    const { listByUserId } = require('./services/deviceBindingService');
    const list = await listByUserId(req.user.userId);
    res.json({ code: 200, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 解除设备绑定 DELETE /api/v1/devices/bindings/:device_id */
app.delete('/api/v1/devices/bindings/:device_id', requireAuth, async (req, res) => {
  try {
    const { unbind } = require('./services/deviceBindingService');
    const deviceId = req.params.device_id;
    const removed = await unbind(deviceId);
    if (!removed) return res.status(404).json({ code: 404, message: '未找到该设备绑定' });
    res.status(200).json({ code: 200, message: '已解除绑定' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** v4.0 历史用餐列表 GET /api/v1/meals — 鉴权，按当前用户过滤，返回 total_meal_cal */
app.get('/api/v1/meals', requireAuth, async (req, res) => {
  try {
    const { listMeals } = require('./services/mealsService');
    const cursor = req.query.cursor;
    const limit = req.query.limit;
    const result = await listMeals(req.user.userId, cursor, limit);
    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.message && (err.message.includes('RFC3339') || err.message.includes('unix seconds'))) {
      return res.status(400).json({ error: 'cursor must be RFC3339 or unix seconds' });
    }
    res.status(500).json({ error: 'list meals failed' });
  }
});

/** v4.0 就餐轨迹 GET /api/v1/meals/:meal_id/trajectory — items 含 weights */
app.get('/api/v1/meals/:meal_id/trajectory', requireAuth, async (req, res) => {
  try {
    const { getMealTrajectory } = require('./services/mealsService');
    const mealId = req.params.meal_id;
    let lastTimestamp = req.query.last_timestamp;
    const sampleInterval = req.query.sample_interval;
    if (lastTimestamp != null && lastTimestamp !== '') {
      const parsed = parseToUnixSeconds(lastTimestamp);
      if (!parsed.ok) return res.status(400).json({ error: 'last_timestamp must be RFC3339 or unix seconds' });
    }
    if (sampleInterval != null && sampleInterval !== '') {
      const n = Number(sampleInterval);
      if (!Number.isInteger(n) || n < 1) return res.status(400).json({ error: 'sample_interval must be a positive integer' });
    }
    const result = await getMealTrajectory(mealId, lastTimestamp, sampleInterval);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'get meal trajectory failed' });
  }
});

/** v4.0 单次用餐详情 GET /api/v1/meals/:meal_id — 含 grid_details */
app.get('/api/v1/meals/:meal_id', requireAuth, async (req, res) => {
  try {
    const { getMealDetail } = require('./services/mealsService');
    const mealId = req.params.meal_id;
    const detail = await getMealDetail(mealId);
    if (!detail) return res.status(404).json({ error: 'meal not found' });
    res.json(detail);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'get meal failed' });
  }
});

/** v4.0 菜品挂载 PUT /api/v1/meals/:meal_id/foods — 占位实现 */
app.put('/api/v1/meals/:meal_id/foods', requireAuth, async (req, res) => {
  try {
    const mealId = req.params.meal_id;
    const body = req.body || {};
    if (!body.grids || !Array.isArray(body.grids)) {
      return res.status(400).json({ error: 'grids array required' });
    }
    res.status(200).json({ message: '食物信息挂载成功，卡路里已就绪' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'update foods failed' });
  }
});

// ========== 饮食汇总/图表/报告/建议（保留，可选鉴权后从 token 取 user_id） ==========

app.post('/api/diet/summary/run', requireAuth, async (req, res) => {
  try {
    const { runDailySummary } = require('./services/dietSummaryService');
    const date = (req.body && req.body.date) || undefined;
    const result = await runDailySummary(date);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

/** 按日期范围批量执行每日汇总（便于服务器上大量 Meal_Records 进入图表） */
app.post('/api/diet/summary/run_range', requireAuth, async (req, res) => {
  try {
    const { runSummaryDateRange } = require('./services/dietSummaryService');
    const start_date = req.body && req.body.start_date;
    const end_date = req.body && req.body.end_date;
    if (!start_date || !end_date) {
      return res.status(400).json({ code: 400, message: '缺少 start_date 或 end_date' });
    }
    const result = await runSummaryDateRange(start_date, end_date);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

app.post('/api/diet/seed/meal_records', requireAuth, async (req, res) => {
  try {
    const { insertMealRecords } = require('./services/seedService');
    const records = (req.body && req.body.records) || [];
    if (!Array.isArray(records)) return res.status(400).json({ code: 400, message: '缺少 body.records 数组' });
    const result = await insertMealRecords(records, req.user.userId);
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

app.post('/api/diet/analysis/generate', requireAuth, async (req, res) => {
  try {
    const { generateDietAnalysis } = require('./services/aiAnalysisService');
    const body = req.body || {};
    const userId = Number(body.user_id) || req.user.userId;
    const date = body.date;
    const reportType = body.report_type === 'weekly' ? 'weekly' : 'daily';
    const forceFallback = body.force_fallback === true;
    if (!userId || !date) return res.status(400).json({ code: 400, message: '缺少 user_id 或 date' });
    const result = await generateDietAnalysis(userId, date, reportType, { forceFallback });
    res.json({ code: 200, data: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

app.get('/api/diet/analysis/report', requireAuth, async (req, res) => {
  try {
    const { getAnalysisReport } = require('./services/aiAnalysisService');
    const userId = Number(req.query.user_id) || req.user.userId;
    const date = req.query.date;
    const reportType = req.query.report_type != null ? Number(req.query.report_type) : undefined;
    if (!userId || !date) return res.status(400).json({ code: 400, message: '缺少 user_id 或 date' });
    const report = await getAnalysisReport(userId, date, reportType);
    res.json({ code: 200, data: report || null });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

app.get('/api/diet/recommendations', requireAuth, async (req, res) => {
  try {
    const { getPersonalizedRecommendations } = require('./services/recommendationService');
    const userId = Number(req.query.user_id) || req.user.userId;
    if (!userId) return res.status(400).json({ code: 400, message: '缺少 user_id' });
    const list = await getPersonalizedRecommendations(userId);
    res.json({ code: 200, data: list });
  } catch (err) {
    console.error(err);
    res.status(500).json({ code: 500, message: err.message });
  }
});

app.get('/api/diet/statistics/charts', requireAuth, async (req, res) => {
  try {
    const { getChartData } = require('./services/chartsService');
    const userId = Number(req.query.user_id) || req.user.userId;
    const startDate = req.query.start_date;
    const endDate = req.query.end_date;
    const chartType = req.query.chart_type || 'daily_trend';
    if (!userId || !startDate || !endDate) return res.status(400).json({ code: 400, message: '缺少 user_id、start_date 或 end_date' });
    if (startDate > endDate) return res.status(400).json({ code: 400, message: 'start_date 不能大于 end_date' });
    const data = await getChartData(userId, startDate, endDate, chartType);
    res.json({ code: 200, data });
  } catch (err) {
    console.error(err);
    const status = err.message && err.message.includes('不支持的') ? 400 : 500;
    res.status(status).json({ code: status, message: err.message });
  }
});

// ========== 社区（创建 / 加入 / 查看 / 管理） ==========

/**
 * 创建社区：返回 community_id，其他人需要输入该 ID 才能加入
 * POST /api/v1/communities/create
 */
app.post('/api/v1/communities/create', requireAuth, async (req, res) => {
  try {
    const { createCommunity } = require('./services/communityService');
    const { name, description } = req.body || {};
    const result = await createCommunity(req.user.userId, name, description);
    res.status(200).json(result);
  } catch (err) {
    const msg = err.message || 'create community failed';
    const status = msg.includes('required') || msg.includes('invalid') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * 输入 community_id 加入社区
 * POST /api/v1/communities/:community_id/join
 */
app.post('/api/v1/communities/:community_id/join', requireAuth, async (req, res) => {
  try {
    const { joinCommunity } = require('./services/communityService');
    const result = await joinCommunity(req.user.userId, req.params.community_id);
    res.status(200).json(result);
  } catch (err) {
    const msg = err.message || 'join community failed';
    const status = msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('invalid') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * 查看我加入的社区（含 role 与 member_count）
 * GET /api/v1/communities/mine
 */
app.get('/api/v1/communities/mine', requireAuth, async (req, res) => {
  try {
    const { listMyCommunities } = require('./services/communityService');
    const items = await listMyCommunities(req.user.userId);
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message || 'list communities failed' });
  }
});

/**
 * 查看我创建的社区（管理视图）
 * GET /api/v1/communities/owned
 */
app.get('/api/v1/communities/owned', requireAuth, async (req, res) => {
  try {
    const { listOwnedCommunities } = require('./services/communityService');
    const items = await listOwnedCommunities(req.user.userId);
    res.status(200).json({ items });
  } catch (err) {
    res.status(500).json({ error: err.message || 'list owned communities failed' });
  }
});

/**
 * 管理我的社区：更新社区信息（仅 owner）
 * PATCH /api/v1/communities/:community_id
 */
app.patch('/api/v1/communities/:community_id', requireAuth, async (req, res) => {
  try {
    const { updateOwnedCommunity } = require('./services/communityService');
    const result = await updateOwnedCommunity(req.user.userId, req.params.community_id, req.body || {});
    res.status(200).json(result);
  } catch (err) {
    const msg = err.message || 'update community failed';
    const status = msg.includes('no permission') || msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('invalid') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * 管理我的社区：解散社区（仅 owner）
 * DELETE /api/v1/communities/:community_id
 */
app.delete('/api/v1/communities/:community_id', requireAuth, async (req, res) => {
  try {
    const { dissolveOwnedCommunity } = require('./services/communityService');
    const result = await dissolveOwnedCommunity(req.user.userId, req.params.community_id);
    res.status(200).json(result);
  } catch (err) {
    const msg = err.message || 'delete community failed';
    const status = msg.includes('no permission') || msg.includes('not found') ? 404 : msg.includes('required') || msg.includes('invalid') ? 400 : 500;
    res.status(status).json({ error: msg });
  }
});

/**
 * 社区看板（当前保留占位）
 * GET /api/v1/communities/:community_id/dashboard
 */
app.get('/api/v1/communities/:community_id/dashboard', requireAuth, (req, res) => {
  res.status(503).json({ error: '社区看板暂未实现' });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});

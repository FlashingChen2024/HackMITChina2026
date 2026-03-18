import { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Alert,
  Container,
  Grid,
  CircularProgress,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchChartData, CHART_TYPES } from '../api/charts';
import ChartBlock from '../components/ChartBlock';

const CHART_LABELS = {
  daily_trend: '日趋势',
  weekly_comparison: '周对比',
  waste_analysis: '浪费率分析',
  speed_analysis: '用餐速度分析',
  nutrition_pie: '营养摄入（卡路里占比）'
};

function useChartOption(chartType, start_date, end_date) {
  const [option, setOption] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);

  const load = useCallback(async () => {
    if (!start_date || !end_date) return;
    setLoading(true);
    setError(null);
    setIsEmpty(false);
    try {
      const res = await fetchChartData({ start_date, end_date });
      const root = res.data || res || {};
      const d = root.chart_data || {};
      const dates = d.dates || [];
      const served = d.daily_served_g || [];
      const intake = d.daily_intake_g || [];
      const calories = d.daily_calories || [];
      const speeds = d.avg_speed_g_per_min || [];

      const hasData =
        dates.length > 0 &&
        (served.some(v => v != null) ||
         intake.some(v => v != null) ||
         calories.some(v => v != null) ||
         speeds.some(v => v != null));
      setIsEmpty(!hasData);

      // 根据不同图表类型，从同一份 chart_data 派生出不同的展示
      if (!hasData) {
        setOption({});
      } else if (chartType === 'daily_trend') {
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['打饭量', '摄入量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [
            { name: '打饭量', type: 'line', data: served, smooth: true },
            { name: '摄入量', type: 'line', data: intake, smooth: true }
          ]
        });
      } else if (chartType === 'weekly_comparison') {
        // 简化：按天展示摄入量柱状图，后端若返回按周聚合数据也兼容
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['摄入量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [{ name: '摄入量', type: 'bar', data: intake }]
        });
      } else if (chartType === 'waste_analysis') {
        // 用 (打饭量 - 摄入量) 近似浪费量
        const waste = served.map((s, i) => {
          const v = Number(s) - Number(intake[i] || 0);
          return v > 0 ? v : 0;
        });
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['浪费量'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g' },
          series: [{ name: '浪费量', type: 'line', data: waste, smooth: true }]
        });
      } else if (chartType === 'speed_analysis') {
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'axis' },
          legend: { data: ['平均速度'], bottom: 0 },
          xAxis: { type: 'category', data: dates },
          yAxis: { type: 'value', name: 'g/min' },
          series: [{ name: '平均速度', type: 'line', data: speeds, smooth: true }]
        });
      } else if (chartType === 'nutrition_pie') {
        // 按日期汇总卡路里做一个饼图
        const pieData = dates.map((dLabel, i) => ({
          name: dLabel,
          value: Number(calories[i] || 0)
        }));
        setOption({
          title: { text: CHART_LABELS[chartType], left: 'center' },
          tooltip: { trigger: 'item' },
          series: [{ type: 'pie', radius: '60%', data: pieData, label: { show: true } }]
        });
      } else {
        setOption({});
      }
    } catch (e) {
      setError(e.message);
      setOption({});
    } finally {
      setLoading(false);
    }
  }, [chartType, start_date, end_date]);

  return [option, loading, error, isEmpty, load];
}

export default function Charts() {
  const currentUser = getCurrentUser();
  const [start_date, setStart_date] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [end_date, setEnd_date] = useState(() => new Date().toISOString().slice(0, 10));

  // 日期校验
  const dateError = start_date && end_date && start_date > end_date ? '开始日期不能晚于结束日期' : null;

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
              📊 统计图表
            </Typography>
            {currentUser && (
              <Alert severity="info" sx={{ mb: 2 }}>
                当前用户：<strong>{currentUser.username}</strong>（ID: {currentUser.userId}）
              </Alert>
            )}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="开始日期"
                  value={start_date}
                  onChange={(e) => setStart_date(e.target.value)}
                  inputProps={{ max: end_date }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="结束日期"
                  value={end_date}
                  onChange={(e) => setEnd_date(e.target.value)}
                  inputProps={{ min: start_date }}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
            </Grid>
            {dateError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                ⚠️ {dateError}
              </Alert>
            )}
          </CardContent>
        </Card>

        {!dateError && CHART_TYPES.map(ct => (
          <ChartSection
            key={ct}
            chartType={ct}
            start_date={start_date}
            end_date={end_date}
          />
        ))}
      </Box>
    </Container>
  );
}

function ChartSection({ chartType, start_date, end_date }) {
  const [option, loading, error, isEmpty, load] = useChartOption(chartType, start_date, end_date);

  // 页面打开时自动加载，或者当日期范围改变时自动加载
  useEffect(() => {
    load();
  }, [start_date, end_date, load]);

  return (
    <Card sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
            {CHART_LABELS[chartType]}
          </Typography>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={load}
            disabled={loading}
          >
            刷新
          </Button>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {!loading && !error && isEmpty && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="body2">
              该日期范围内无汇总数据。图表显示的是<strong>每日汇总</strong>（含 Mock 与餐盒遥测）：
              <br />
              • 若用<strong>遥测</strong>：先绑定设备，运行 <code>bash scripts/test_telemetry_flow.sh</code>（可用 TOKEN=你的Token 以当前用户写入），再对<strong>当日</strong>执行「每日汇总」（POST /api/diet/summary/run，body 传 date 如 2026-03-13）后刷新。
              <br />
              • 若用<strong>Mock</strong>：<code>POST /api/diet/seed/meal_records</code> 导入后，对导入日期执行「每日汇总」或运行 <code>bash scripts/seed_mock_meal_records.sh</code>。
            </Typography>
          </Alert>
        )}
        <Box sx={{ minHeight: 320, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {loading ? (
            <CircularProgress />
          ) : (
            <ChartBlock option={option} loading={loading} height="400px" />
          )}
        </Box>
      </CardContent>
    </Card>
  );
}

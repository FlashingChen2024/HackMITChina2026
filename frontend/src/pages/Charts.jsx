import { useState, useCallback, useEffect } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, TextField, Typography, useTheme, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, DateRange as DateIcon } from '@mui/icons-material';
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

      const baseOption = {
        tooltip: { 
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#E2E8F0',
          textStyle: { color: '#1E293B' },
          borderRadius: 8
        },
        legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: '#64748B' } },
        grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true }
      };

      if (!hasData) {
        setOption({});
      } else if (chartType === 'daily_trend') {
        setOption({
          ...baseOption,
          color: ['#00BFA5', '#4F46E5'],
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B' } },
          yAxis: { type: 'value', name: 'g', splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }, nameTextStyle: { color: '#64748B' } },
          series: [
            { name: '打饭量', type: 'line', data: served, smooth: true, areaStyle: { opacity: 0.1 } },
            { name: '摄入量', type: 'line', data: intake, smooth: true, areaStyle: { opacity: 0.1 } }
          ]
        });
      } else if (chartType === 'weekly_comparison') {
        setOption({
          ...baseOption,
          color: ['#3B82F6'],
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B' } },
          yAxis: { type: 'value', name: 'g', splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } },
          series: [{ name: '摄入量', type: 'bar', data: intake, itemStyle: { borderRadius: [4, 4, 0, 0] } }]
        });
      } else if (chartType === 'waste_analysis') {
        const waste = served.map((s, i) => {
          const v = Number(s) - Number(intake[i] || 0);
          return v > 0 ? v : 0;
        });
        setOption({
          ...baseOption,
          color: ['#EF4444'],
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B' } },
          yAxis: { type: 'value', name: 'g', splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } },
          series: [{ name: '浪费量', type: 'line', data: waste, smooth: true, areaStyle: { opacity: 0.1 } }]
        });
      } else if (chartType === 'speed_analysis') {
        setOption({
          ...baseOption,
          color: ['#F59E0B'],
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B' } },
          yAxis: { type: 'value', name: 'g/min', splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } },
          series: [{ name: '平均速度', type: 'line', data: speeds, smooth: true }]
        });
      } else if (chartType === 'nutrition_pie') {
        const pieData = dates.map((dLabel, i) => ({
          name: dLabel,
          value: Number(calories[i] || 0)
        }));
        setOption({
          tooltip: { trigger: 'item', backgroundColor: 'rgba(255, 255, 255, 0.9)', borderColor: '#E2E8F0', borderRadius: 8 },
          legend: { bottom: 0, textStyle: { color: '#64748B' } },
          color: ['#00BFA5', '#4F46E5', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'],
          series: [{ 
            type: 'pie', 
            radius: ['40%', '70%'], 
            avoidLabelOverlap: false,
            itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: pieData 
          }]
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

  // Auto load on mount or date change
  useEffect(() => {
    load();
  }, [load]);

  return [option, loading, error, isEmpty, load];
}

export default function Charts() {
  const currentUser = getCurrentUser();
  const theme = useTheme();
  const [start_date, setStart_date] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [end_date, setEnd_date] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>健康数据看板</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>基于您的历史就餐记录生成的多维度分析</Typography>
        </Box>
        {currentUser && (
          <Chip 
            label={`用户: ${currentUser.username}`} 
            color="primary" 
            variant="outlined" 
            sx={{ fontWeight: 600, bgcolor: 'rgba(0,191,165,0.08)', border: 'none' }} 
          />
        )}
      </Box>

      <Card sx={{ mb: 4, bgcolor: '#fff' }}>
        <CardContent sx={{ p: 3, display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748B' }}>
            <DateIcon />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>选择时间范围</Typography>
          </Box>
          <TextField
            type="date"
            size="small"
            value={start_date}
            onChange={e => setStart_date(e.target.value)}
            sx={{ width: { xs: '100%', sm: 180 } }}
          />
          <Typography sx={{ color: '#94A3B8', display: { xs: 'none', sm: 'block' } }}>至</Typography>
          <TextField
            type="date"
            size="small"
            value={end_date}
            onChange={e => setEnd_date(e.target.value)}
            sx={{ width: { xs: '100%', sm: 180 } }}
          />
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {CHART_TYPES.map(ct => (
          <Grid item xs={12} md={ct === 'daily_trend' ? 12 : 6} key={ct}>
            <ChartSection
              chartType={ct}
              start_date={start_date}
              end_date={end_date}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}

function ChartSection({ chartType, start_date, end_date }) {
  const [option, loading, error, isEmpty, load] = useChartOption(chartType, start_date, end_date);

  return (
    <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, p: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>{CHART_LABELS[chartType]}</Typography>
          <Tooltip title="重新加载">
            <IconButton onClick={load} disabled={loading} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon fontSize="small" sx={{ color: '#64748B' }} />
            </IconButton>
          </Tooltip>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {!loading && !error && isEmpty && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            当前时间范围内暂无数据。
          </Alert>
        )}
        <Box sx={{ width: '100%', height: 320, opacity: (loading || isEmpty) ? 0.3 : 1, transition: 'opacity 0.3s' }}>
          <ChartBlock option={option} loading={loading} />
        </Box>
      </CardContent>
    </Card>
  );
}
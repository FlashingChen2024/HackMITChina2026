import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert, Box, Card, CardContent, Grid, TextField, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, DateRange as DateIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchChartData, CHART_TYPES } from '../api/charts';
import { fetchMeals } from '../api/meals';
import ChartBlock from '../components/ChartBlock';

const CHART_LABELS = {
  daily_trend: '日趋势',
  weekly_comparison: '周对比',
  waste_analysis: '浪费率分析',
  speed_analysis: '用餐速度分析',
  nutrition_pie: '营养摄入（卡路里占比）',
  meal_times: '每餐用餐时长',
};

// 将数据按周聚合
function aggregateByWeek(dates, values) {
  const weekMap = new Map();
  
  dates.forEach((date, index) => {
    const d = new Date(date);
    // 获取该日期所在周的周一
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    const weekKey = monday.toISOString().slice(0, 10);
    const weekLabel = `${monday.getMonth() + 1}/${monday.getDate()}`;
    
    if (!weekMap.has(weekKey)) {
      weekMap.set(weekKey, { label: weekLabel, values: [], total: 0 });
    }
    const week = weekMap.get(weekKey);
    week.values.push(Number(values[index]) || 0);
    week.total += Number(values[index]) || 0;
  });
  
  // 转换为数组并排序
  const sorted = Array.from(weekMap.entries())
    .sort((a, b) => new Date(a[0]) - new Date(b[0]));
  
  return {
    labels: sorted.map(([_, data]) => data.label),
    // 周对比显示平均摄入量
    values: sorted.map(([_, data]) => 
      data.values.length > 0 ? Number((data.total / data.values.length).toFixed(1)) : 0
    ),
    totals: sorted.map(([_, data]) => Number(data.total.toFixed(1)))
  };
}

// 限制饼图数据点数量，防止浏览器卡死
function limitPieData(dates, calories, maxItems = 7) {
  const data = dates.map((date, i) => ({
    name: date,
    value: Number(calories[i]) || 0,
    originalIndex: i
  })).filter(item => item.value > 0);
  
  // 按值从大到小排序
  data.sort((a, b) => b.value - a.value);
  
  if (data.length <= maxItems) {
    return data;
  }
  
  // 取前 maxItems-1 个，其余合并为"其他"
  const topItems = data.slice(0, maxItems - 1);
  const otherItems = data.slice(maxItems - 1);
  const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);
  
  return [
    ...topItems,
    { name: '其他', value: Number(otherValue.toFixed(1)), isOther: true }
  ];
}

function useChartOption(chartType, start_date, end_date) {
  const [option, setOption] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const [rawData, setRawData] = useState(null);

  const load = useCallback(async () => {
    if (!start_date || !end_date) return;
    if (new Date(start_date) > new Date(end_date)) return;
    
    setLoading(true);
    setError(null);
    setIsEmpty(false);
    try {
      if (chartType === 'meal_times') {
        const meals = await fetchMealsInLocalDateRange(start_date, end_date);
        const { labels, dur1, dur2, dur3 } = buildDailyMealDurationSeries(start_date, end_date, meals);

        const hasAny =
          dur1.some((v) => v != null) || dur2.some((v) => v != null) || dur3.some((v) => v != null);
        if (!hasAny) {
          setIsEmpty(true);
          setOption({});
          return;
        }

        setIsEmpty(false);
        setOption({
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.95)',
            borderColor: '#E2E8F0',
            borderRadius: 8,
            textStyle: { color: '#1E293B' },
            formatter: (params) => {
              if (!Array.isArray(params) || params.length === 0) return '';
              const ax = params[0].axisValue;
              const lines = [`<strong>${ax}</strong>`];
              for (const p of params) {
                const v = p.value;
                const txt = typeof v === 'number' && Number.isFinite(v) ? `${v} 分钟` : '—';
                lines.push(`${p.marker}${p.seriesName}：${txt}`);
              }
              return lines.join('<br/>');
            },
          },
          legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: '#64748B' } },
          grid: { left: '3%', right: '5%', bottom: '12%', top: '10%', containLabel: true },
          color: ['#06B6D4', '#7C3AED', '#F59E0B'],
          xAxis: {
            type: 'category',
            data: labels,
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { color: '#64748B' },
            boundaryGap: false,
          },
          yAxis: {
            type: 'value',
            name: '用餐时长 (分钟)',
            nameTextStyle: { color: '#64748B' },
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
            axisLabel: { color: '#64748B' },
          },
          series: [
            {
              name: '第1餐',
              type: 'line',
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              data: dur1,
              areaStyle: { opacity: 0.06 },
            },
            {
              name: '第2餐',
              type: 'line',
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              data: dur2,
              areaStyle: { opacity: 0.06 },
            },
            {
              name: '第3餐',
              type: 'line',
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              data: dur3,
              areaStyle: { opacity: 0.06 },
            },
          ],
        });
        return;
      }

      const res = await fetchChartData({ start_date, end_date });
      // 严格按照 API 文档解析响应
      const root = res || {};
      const d = root.chart_data || {};
      
      // API 返回的数据结构
      const dates = d.dates || [];
      const served = d.daily_served_g || [];
      const intake = d.daily_intake_g || [];
      const calories = d.daily_calories || [];
      const speeds = d.avg_speed_g_per_min || [];
      
      setRawData({ dates, served, intake, calories, speeds });

      let hasData =
        dates.length > 0 &&
        (served.some(v => v != null && v>0) ||
         intake.some(v => v != null) ||
         calories.some(v => v != null) ||
         speeds.some(v => v != null));

      const { weekLabels, weeklyIntake } =
        chartType === 'weekly_comparison'
          ? aggregateIntakeByCalendarWeek(start_date, end_date, intake)
          : { weekLabels: [], weeklyIntake: [] };

      if (chartType === 'weekly_comparison') {
        hasData = weekLabels.length > 0 && weeklyIntake.some((v) => v > 0);
      }
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
          xAxis: {
            type: 'category',
            data: weekLabels,
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { color: '#64748B', interval: 0, rotate: weekLabels.length > 5 ? 30 : 0 },
          },
          yAxis: {
            type: 'value',
            name: '周累计 (g)',
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
            nameTextStyle: { color: '#64748B' },
          },
          series: [{
            name: '周摄入量',
            type: 'bar',
            data: weeklyIntake,
            itemStyle: { borderRadius: [4, 4, 0, 0] },
          }],
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
  const [start_date, setStart_date] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return d.toISOString().slice(0, 10);
  });
  const [end_date, setEnd_date] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateError, setDateError] = useState('');

  // 验证日期范围
  const validateDates = (start, end) => {
    if (start && end && new Date(start) > new Date(end)) {
      setDateError('结束日期不能早于开始日期');
      return false;
    }
    setDateError('');
    return true;
  };

  const handleStartDateChange = (e) => {
    const newStart = e.target.value;
    setStart_date(newStart);
    validateDates(newStart, end_date);
  };

  const handleEndDateChange = (e) => {
    const newEnd = e.target.value;
    setEnd_date(newEnd);
    validateDates(start_date, newEnd);
  };

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
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, alignItems: 'flex-start' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#64748B', mt: 1 }}>
              <DateIcon />
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>选择时间范围</Typography>
            </Box>
            <TextField
              type="date"
              size="small"
              label="开始日期"
              value={start_date}
              onChange={handleStartDateChange}
              error={!!dateError}
              sx={{ width: { xs: '100%', sm: 180 } }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography sx={{ color: '#94A3B8', mt: 1, display: { xs: 'none', sm: 'block' } }}>至</Typography>
            <TextField
              type="date"
              size="small"
              label="结束日期"
              value={end_date}
              onChange={handleEndDateChange}
              error={!!dateError}
              helperText={dateError}
              sx={{ width: { xs: '100%', sm: 180 } }}
              InputLabelProps={{ shrink: true }}
              inputProps={{
                min: start_date
              }}
            />
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        {CHART_TYPES.map(ct => (
          <Grid item xs={12} md={ct === 'daily_trend' || ct === 'meal_times' ? 12 : 6} key={ct}>
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
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 1 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>{CHART_LABELS[chartType]}</Typography>
            {chartType === 'meal_times' && (
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                按所选起止日（本地）逐日统计：每天按<strong>开餐先后</strong>取第 1～3 餐，纵轴为各餐<strong>用餐时长</strong>（分钟，来自就餐记录中的用餐时长字段）。
              </Typography>
            )}
          </Box>
          <Tooltip title="重新加载">
            <IconButton onClick={load} disabled={loading} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon fontSize="small" sx={{ color: '#64748B' }} />
            </IconButton>
          </Tooltip>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {!loading && !error && isEmpty && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            {chartType === 'meal_times'
              ? '所选日期范围内无有效用餐时长数据（无就餐记录、或未返回 duration_minutes），或分页未覆盖全部历史。'
              : '当前时间范围内暂无数据。'}
          </Alert>
        )}
        <Box sx={{ width: '100%', height: 320, opacity: (loading || isEmpty) ? 0.3 : 1, transition: 'opacity 0.3s' }}>
          <ChartBlock option={option} loading={loading} />
        </Box>
      </CardContent>
    </Card>
  );
}

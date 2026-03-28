import { useState, useCallback, useEffect } from 'react';
import { Alert, Box, Button, Card, CardContent, Grid, TextField, Typography, useTheme, Chip, IconButton, Tooltip } from '@mui/material';
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

/**
 * 枚举起止日期内每一天（本地日历），含首尾。
 *
 * @param {string} startStr `YYYY-MM-DD`
 * @param {string} endStr `YYYY-MM-DD`
 * @returns {Date[]}
 */
function enumerateDaysInclusive(startStr, endStr) {
  const out = [];
  const cur = new Date(`${startStr}T12:00:00`);
  const end = new Date(`${endStr}T12:00:00`);
  if (Number.isNaN(cur.getTime()) || Number.isNaN(end.getTime()) || cur > end) return out;
  for (let d = new Date(cur); d <= end; d.setDate(d.getDate() + 1)) {
    out.push(new Date(d));
  }
  return out;
}

/**
 * 取该日期所在周的周一（00:00 本地）。
 *
 * @param {Date} d
 * @returns {Date}
 */
function startOfWeekMonday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  x.setDate(x.getDate() + diff);
  return x;
}

/**
 * 周标签：周一–周日，如 `3/3–3/9`。
 *
 * @param {Date} weekMonday
 * @returns {string}
 */
function formatWeekRangeLabel(weekMonday) {
  const sun = new Date(weekMonday);
  sun.setDate(sun.getDate() + 6);
  const fmt = (dt) => `${dt.getMonth() + 1}/${dt.getDate()}`;
  return `${fmt(weekMonday)}–${fmt(sun)}`;
}

/**
 * 将按日对齐的摄入量等汇总为「每周一根柱」。
 *
 * @param {string} start_date
 * @param {string} end_date
 * @param {number[]} intake
 * @returns {{ weekLabels: string[], weeklyIntake: number[] }}
 */
function aggregateIntakeByCalendarWeek(start_date, end_date, intake) {
  const days = enumerateDaysInclusive(start_date, end_date);
  const len = Math.min(days.length, intake.length);
  /** @type {Map<string, { monday: Date, sum: number }>} */
  const map = new Map();
  for (let i = 0; i < len; i++) {
    const monday = startOfWeekMonday(days[i]);
    const key = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const prev = map.get(key);
    const add = Number(intake[i]) || 0;
    if (prev) prev.sum += add;
    else map.set(key, { monday: new Date(monday), sum: add });
  }
  const entries = [...map.entries()].sort((a, b) => a[1].monday.getTime() - b[1].monday.getTime());
  return {
    weekLabels: entries.map(([, v]) => formatWeekRangeLabel(v.monday)),
    weeklyIntake: entries.map(([, v]) => Math.round(v.sum * 10) / 10),
  };
}

/**
 * 将 ISO 时间戳格式化为本地日历日 `YYYY-MM-DD`。
 *
 * @param {string} iso
 * @returns {string}
 */
function localDayKeyFromIso(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 本地日历日 `Date` → `YYYY-MM-DD`。
 *
 * @param {Date} dt
 * @returns {string}
 */
function localDayKeyFromDate(dt) {
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const day = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * 分页拉取 `/meals`（降序），收集落在 `[startStr, endStr]` 本地日历日内（含边界）的全部餐次。
 * 翻页直到本页最早一餐早于 `startStr` 的 0 点或达到页数上限。
 *
 * @param {string} startStr `YYYY-MM-DD`
 * @param {string} endStr `YYYY-MM-DD`
 * @param {number} [maxPages]
 * @returns {Promise<Array<{ meal_id: string, start_time: string, duration_minutes?: number }>>}
 */
async function fetchMealsInLocalDateRange(startStr, endStr, maxPages = 100) {
  const rangeStart = new Date(`${startStr}T00:00:00`);
  const rangeEnd = new Date(`${endStr}T23:59:59.999`);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    return [];
  }

  /** @type {Array<{ meal_id: string, start_time: string, duration_minutes?: number }>} */
  const out = [];
  let cursor = undefined;

  for (let p = 0; p < maxPages; p += 1) {
    const res = await fetchMeals({ cursor, limit: 20 });
    const items = res.items || [];
    if (items.length === 0) break;

    for (const it of items) {
      const t = new Date(it.start_time);
      if (t >= rangeStart && t <= rangeEnd) out.push(it);
    }

    const last = items[items.length - 1];
    const lastT = new Date(last.start_time);
    if (lastT < rangeStart) break;
    if (!res.next_cursor) break;
    cursor = res.next_cursor;
  }

  return out;
}

/**
 * 按本地日对齐：每天按开餐先后取第 1～3 餐的用餐时长（`duration_minutes`），与 `enumerateDaysInclusive` 顺序一致。
 *
 * @param {string} start_date
 * @param {string} end_date
 * @param {Array<{ start_time: string, duration_minutes?: number }>} meals
 * @returns {{ labels: string[], dur1: (number|null)[], dur2: (number|null)[], dur3: (number|null)[] }}
 */
function buildDailyMealDurationSeries(start_date, end_date, meals) {
  const days = enumerateDaysInclusive(start_date, end_date);
  /** @type {Map<string, Array<{ start_time: string, duration_minutes?: number }>>} */
  const byDay = new Map();

  for (const m of meals) {
    const key = localDayKeyFromIso(m.start_time);
    if (!key || key < start_date || key > end_date) continue;
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(m);
  }

  const labels = [];
  const dur1 = [];
  const dur2 = [];
  const dur3 = [];

  for (const d of days) {
    const key = localDayKeyFromDate(d);
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    const arr = (byDay.get(key) || [])
      .slice()
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());

    const slot = (idx) => {
      const meal = arr[idx];
      if (!meal) return null;
      const raw = meal.duration_minutes;
      if (raw == null || !Number.isFinite(Number(raw))) return null;
      return Math.round(Number(raw) * 10) / 10;
    };

    dur1.push(slot(0));
    dur2.push(slot(1));
    dur3.push(slot(2));
  }

  return { labels, dur1, dur2, dur3 };
}

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
      const root = res.data || res || {};
      const d = root.chart_data || {};
      const dates = d.dates || [];
      const served = d.daily_served_g || [];
      const intake = d.daily_intake_g || [];
      const calories = d.daily_calories || [];
      const speeds = d.avg_speed_g_per_min || [];

      let hasData =
        dates.length > 0 &&
        (served.some(v => v != null) ||
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
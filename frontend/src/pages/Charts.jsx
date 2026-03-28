import { useState, useCallback, useEffect } from 'react';
import { Alert, Box, Card, CardContent, Grid, TextField, Typography, Chip, IconButton, Tooltip } from '@mui/material';
import { Refresh as RefreshIcon, DateRange as DateIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchChartData, CHART_TYPES } from '../api/charts';
import { fetchMeals } from '../api/meals';
import ChartBlock from '../components/ChartBlock';

const CHART_LABELS = {
  daily_trend: 'Daily Trend',
  weekly_comparison: 'Weekly Comparison',
  waste_analysis: 'Waste Analysis',
  speed_analysis: 'Eating Speed Analysis',
  nutrition_pie: 'Nutrition Intake (Calorie Ratio)',
  meal_times: 'The duration of daily meals',
};

/**
 * Enumerate each day in a date range (local calendar), inclusive.
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
 * Aggregate daily intake by natural week to get one bar per week.
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
 * Fetch `/meals` page by page and collect meals within local date range.
 *
 * @param {string} startStr
 * @param {string} endStr
 * @param {number} [maxPages]
 * @returns {Promise<Array<{ meal_id: string, start_time: string, duration_minutes?: number, total_meal_cal?: number }>>}
 */
async function fetchMealsInLocalDateRange(startStr, endStr, maxPages = 100) {
  const rangeStart = new Date(`${startStr}T00:00:00`);
  const rangeEnd = new Date(`${endStr}T23:59:59.999`);
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd) {
    return [];
  }
  /** @type {Array<{ meal_id: string, start_time: string, duration_minutes?: number, total_meal_cal?: number }>} */
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
 * Meal duration in minutes (`duration_minutes`) derived by backend end-start time.
 *
 * @param {{ duration_minutes?: number }} m
 * @returns {number | null}
 */
function mealDurationMinutesFromRecord(m) {
  const d = Number(m.duration_minutes);
  if (!Number.isFinite(d) || d < 0) return null;
  return Math.round(d * 10) / 10;
}

/**
 * Slot by local start time: breakfast 5≤h<11, lunch 11≤h<15, dinner otherwise.
 *
 * @param {string} iso
 * @returns {'breakfast' | 'lunch' | 'dinner'}
 */
function classifyThreeMealsLocal(iso) {
  const h = new Date(iso).getHours();
  if (h >= 5 && h < 11) return 'breakfast';
  if (h >= 11 && h < 15) return 'lunch';
  return 'dinner';
}

/**
 * Three daily series: breakfast/lunch/dinner cumulative duration (minutes).
 *
 * @param {string} start_date
 * @param {string} end_date
 * @param {Array<{ start_time: string, duration_minutes?: number }>} meals
 * @returns {{ labels: string[], breakfast: (number|null)[], lunch: (number|null)[], dinner: (number|null)[] }}
 */
function buildDailyThreeMealDurationSeries(start_date, end_date, meals) {
  const days = enumerateDaysInclusive(start_date, end_date);
  /** @type {Map<string, { breakfast: number, lunch: number, dinner: number }>} */
  const byDay = new Map();

  for (const m of meals) {
    const key = localDayKeyFromIso(m.start_time);
    if (!key || key < start_date || key > end_date) continue;
    const mins = mealDurationMinutesFromRecord(m);
    if (mins == null) continue;
    const slot = classifyThreeMealsLocal(m.start_time);
    if (!byDay.has(key)) {
      byDay.set(key, { breakfast: 0, lunch: 0, dinner: 0 });
    }
    const row = byDay.get(key);
    row[slot] += mins;
  }

  const labels = [];
  const breakfast = [];
  const lunch = [];
  const dinner = [];
  const roundOrNull = (x) => (x > 0 ? Math.round(x * 10) / 10 : null);

  for (const d of days) {
    const key = localDayKeyFromDate(d);
    labels.push(`${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    const row = byDay.get(key);
    if (!row) {
      breakfast.push(null);
      lunch.push(null);
      dinner.push(null);
    } else {
      breakfast.push(roundOrNull(row.breakfast));
      lunch.push(roundOrNull(row.lunch));
      dinner.push(roundOrNull(row.dinner));
    }
  }
  return { labels, breakfast, lunch, dinner };
}

/**
 * Limit pie sectors; `labels` and `values` must align one-to-one.
 *
 * @param {string[]} labels
 * @param {number[]} values
 * @param {number} [maxItems]
 */
function limitPieData(labels, values, maxItems = 7) {
  const data = labels.map((name, i) => ({
    name,
    value: Number(values[i]) || 0,
    originalIndex: i
  })).filter(item => item.value > 0);
  
  // Sort descending by value.
  data.sort((a, b) => b.value - a.value);
  
  if (data.length <= maxItems) {
    return data;
  }
  
  // Keep top maxItems-1 and merge the rest as "Other".
  const topItems = data.slice(0, maxItems - 1);
  const otherItems = data.slice(maxItems - 1);
  const otherValue = otherItems.reduce((sum, item) => sum + item.value, 0);
  
  return [
    ...topItems,
    { name: 'Other', value: Number(otherValue.toFixed(1)), isOther: true }
  ];
}

/**
 * Build pie legend labels using local "MM-DD HH:mm".
 *
 * @param {string} iso
 * @returns {string | null}
 */
function mealCaloriePieDisplayBase(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const md = `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const t = d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${md} ${t}`;
}

/**
 * Build pie data from each meal `total_meal_cal` (not daily-aggregated statistics).
 *
 * @param {Array<{ start_time: string, total_meal_cal?: number }>} meals
 * @param {number} maxSlices
 * @returns {{ pieData: { name: string, value: number }[] }}
 */
function buildPerMealCaloriePieData(meals, maxSlices = 16) {
  /** @type {Map<string, number>} */
  const baseCounts = new Map();
  const names = [];
  const values = [];
  let fallbackIdx = 0;
  for (const m of meals) {
    const cal = Number(m.total_meal_cal);
    if (!Number.isFinite(cal) || cal <= 0) continue;
    const base = mealCaloriePieDisplayBase(m.start_time);
    let label;
    if (!base) {
      fallbackIdx += 1;
      label = `Meal ${fallbackIdx}`;
    } else {
      const n = (baseCounts.get(base) || 0) + 1;
      baseCounts.set(base, n);
      label = n === 1 ? base : `${base} #${n}`;
    }
    names.push(label);
    values.push(Math.round(cal * 10) / 10);
  }
  const sortedIdx = names.map((_, i) => i).sort((a, b) => values[b] - values[a]);
  const sn = sortedIdx.map((i) => names[i]);
  const sv = sortedIdx.map((i) => values[i]);
  const limited = limitPieData(sn, sv, maxSlices);
  const pieData = limited.map(({ name, value }) => ({ name, value }));
  return { pieData };
}

function useChartOption(chartType, start_date, end_date) {
  const [option, setOption] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEmpty, setIsEmpty] = useState(false);
  const load = useCallback(async () => {
    if (!start_date || !end_date) return;
    if (new Date(start_date) > new Date(end_date)) return;
    
    setLoading(true);
    setError(null);
    setIsEmpty(false);
    try {
      if (chartType === 'meal_times') {
        const meals = await fetchMealsInLocalDateRange(start_date, end_date);
        const { labels, breakfast, lunch, dinner } = buildDailyThreeMealDurationSeries(
          start_date,
          end_date,
          meals,
        );

        const hasAny =
          breakfast.some((v) => v != null)
          || lunch.some((v) => v != null)
          || dinner.some((v) => v != null);
        if (!hasAny) {
          setIsEmpty(true);
          setOption({});
          return;
        }

        const baseMeal = {
          tooltip: {
            trigger: 'axis',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#E2E8F0',
            textStyle: { color: '#1E293B' },
            borderRadius: 8,
            formatter: (params) => {
              if (!Array.isArray(params) || params.length === 0) return '';
              const ax = params[0].axisValue;
              const lines = [`<strong>${ax}</strong>`];
              for (const p of params) {
                const v = p.value;
                const txt = typeof v === 'number' && Number.isFinite(v) ? `${v} min` : '—';
                lines.push(`${p.marker}${p.seriesName}：${txt}`);
              }
              return lines.join('<br/>');
            },
          },
          legend: { bottom: 0, itemWidth: 12, itemHeight: 12, textStyle: { color: '#64748B' } },
          grid: { left: '3%', right: '4%', bottom: '10%', top: '10%', containLabel: true },
        };

        setIsEmpty(false);
        setOption({
          ...baseMeal,
          color: ['#00BFA5', '#4F46E5', '#F59E0B'],
          xAxis: {
            type: 'category',
            data: labels,
            axisLine: { lineStyle: { color: '#E2E8F0' } },
            axisLabel: { color: '#64748B' },
            boundaryGap: false,
          },
          yAxis: {
            type: 'value',
            name: 'Minutes',
            nameTextStyle: { color: '#64748B' },
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
            axisLabel: { color: '#64748B' },
          },
          series: [
            {
              name: 'Breakfast',
              type: 'line',
              data: breakfast,
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              areaStyle: { opacity: 0.1 },
            },
            {
              name: 'Lunch',
              type: 'line',
              data: lunch,
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              areaStyle: { opacity: 0.1 },
            },
            {
              name: 'Dinner',
              type: 'line',
              data: dinner,
              smooth: true,
              showSymbol: true,
              connectNulls: false,
              areaStyle: { opacity: 0.1 },
            },
          ],
        });
        return;
      }

      if (chartType === 'nutrition_pie') {
        const meals = await fetchMealsInLocalDateRange(start_date, end_date);
        const { pieData } = buildPerMealCaloriePieData(meals, 16);
        if (pieData.length === 0) {
          setIsEmpty(true);
          setOption({});
          return;
        }
        setIsEmpty(false);
        setOption({
          tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            borderColor: '#E2E8F0',
            borderRadius: 8,
            formatter: (p) => {
              const v = p.value;
              const num = typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : String(v);
              const pct = typeof p.percent === 'number' ? p.percent.toFixed(1) : '';
              return `${p.marker}${p.name}<br/>${num} kcal${pct !== '' ? ` (${pct}%)` : ''}`;
            },
          },
          legend: { type: 'scroll', bottom: 0, textStyle: { color: '#64748B' } },
          color: ['#00BFA5', '#4F46E5', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'],
          series: [{
            type: 'pie',
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            itemStyle: { borderWidth: 0, borderColor: 'transparent', borderRadius: 0 },
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
            labelLine: { show: false },
            data: pieData,
          }],
        });
        return;
      }

      const res = await fetchChartData({ start_date, end_date });
      // Parse response strictly according to API docs.
      const root = res || {};
      const d = root.chart_data || {};
      
      // API response structure
      const dates = d.dates || [];
      const served = d.daily_served_g || [];
      const intake = d.daily_intake_g || [];
      const calories = d.daily_calories || [];
      const speeds = d.avg_speed_g_per_min || [];
      
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
            { name: 'Served', type: 'line', data: served, smooth: true, areaStyle: { opacity: 0.1 } },
            { name: 'Intake', type: 'line', data: intake, smooth: true, areaStyle: { opacity: 0.1 } }
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
            name: 'Weekly Total (g)',
            splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
            nameTextStyle: { color: '#64748B' },
          },
          series: [{
            name: 'Weekly Intake',
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
          series: [{ name: 'Waste', type: 'line', data: waste, smooth: true, areaStyle: { opacity: 0.1 } }]
        });
      } else if (chartType === 'speed_analysis') {
        setOption({
          ...baseOption,
          color: ['#F59E0B'],
          xAxis: { type: 'category', data: dates, axisLine: { lineStyle: { color: '#E2E8F0' } }, axisLabel: { color: '#64748B' } },
          yAxis: { type: 'value', name: 'g/min', splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } },
          series: [{ name: 'Average Speed', type: 'line', data: speeds, smooth: true }]
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

  // Validate date range
  const validateDates = (start, end) => {
    if (start && end && new Date(start) > new Date(end)) {
      setDateError('End date cannot be earlier than start date.');
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
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>Health Dashboard</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>Multi-dimensional analytics based on your meal history.</Typography>
        </Box>
        {currentUser && (
          <Chip 
            label={`User: ${currentUser.username}`} 
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
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Select Date Range</Typography>
            </Box>
            <TextField
              type="date"
              size="small"
              label="Start Date"
              value={start_date}
              onChange={handleStartDateChange}
              error={!!dateError}
              sx={{ width: { xs: '100%', sm: 180 } }}
              InputLabelProps={{ shrink: true }}
            />
            <Typography sx={{ color: '#94A3B8', mt: 1, display: { xs: 'none', sm: 'block' } }}>to</Typography>
            <TextField
              type="date"
              size="small"
              label="End Date"
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
                This chart is also daily. Meal duration is <strong>end time - start time</strong> in minutes (`duration_minutes`).
                Meals are bucketed by <strong>local start time</strong>: breakfast 5:00-11:00, lunch 11:00-15:00, dinner otherwise; multiple meals in one bucket are <strong>summed</strong>.
              </Typography>
            )}
            {chartType === 'nutrition_pie' && (
              <Typography variant="caption" sx={{ color: '#64748B', display: 'block', mt: 0.5 }}>
                Each sector maps to <strong>one meal</strong>'s total calories (`total_meal_cal`), unlike cloud daily aggregation by <strong>calendar day</strong>.
                Too many meals are merged into <strong>Other</strong>; incomplete pagination may miss meals.
              </Typography>
            )}
          </Box>
          <Tooltip title="Reload">
            <IconButton onClick={load} disabled={loading} size="small" sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon fontSize="small" sx={{ color: '#64748B' }} />
            </IconButton>
          </Tooltip>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        {!loading && !error && isEmpty && (
          <Alert severity="info" sx={{ mb: 2, borderRadius: 2 }}>
            {chartType === 'meal_times'
              ? 'No valid data in selected range: no meals, missing duration_minutes, or incomplete pagination.'
              : chartType === 'nutrition_pie'
                ? 'No valid data in selected range: no meals, total_meal_cal is 0/missing, or incomplete pagination.'
                : 'No data in the current time range.'}
          </Alert>
        )}
        <Box sx={{ width: '100%', height: 320, opacity: (loading || isEmpty) ? 0.3 : 1, transition: 'opacity 0.3s' }}>
          <ChartBlock option={option} loading={loading} />
        </Box>
      </CardContent>
    </Card>
  );
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import { Alert, Box, Card, CardContent, Grid, TextField, Typography, Chip, IconButton, Tooltip } from '@mui/material';
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

      const hasData = dates.length > 0 && (
        served.some(v => v != null && v > 0) ||
        intake.some(v => v != null && v > 0) ||
        calories.some(v => v != null && v > 0) ||
        speeds.some(v => v != null && v > 0)
      );
      
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
        setLoading(false);
        return;
      }

      switch (chartType) {
        case 'daily_trend': {
          setOption({
            ...baseOption,
            color: ['#00BFA5', '#4F46E5'],
            xAxis: { 
              type: 'category', 
              data: dates, 
              axisLine: { lineStyle: { color: '#E2E8F0' } }, 
              axisLabel: { color: '#64748B' } 
            },
            yAxis: { 
              type: 'value', 
              name: 'g', 
              splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }, 
              nameTextStyle: { color: '#64748B' } 
            },
            series: [
              { name: '打饭量', type: 'line', data: served, smooth: true, areaStyle: { opacity: 0.1 } },
              { name: '摄入量', type: 'line', data: intake, smooth: true, areaStyle: { opacity: 0.1 } }
            ]
          });
          break;
        }
        
        case 'weekly_comparison': {
          // 按周聚合数据
          const weeklyData = aggregateByWeek(dates, intake);
          
          setOption({
            ...baseOption,
            color: ['#3B82F6'],
            xAxis: { 
              type: 'category', 
              data: weeklyData.labels, 
              axisLine: { lineStyle: { color: '#E2E8F0' } }, 
              axisLabel: { color: '#64748B' },
              name: '周(开始日期)',
              nameLocation: 'end',
              nameTextStyle: { color: '#94A3B8', fontSize: 12 }
            },
            yAxis: { 
              type: 'value', 
              name: '平均摄入量(g)', 
              splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
              nameTextStyle: { color: '#64748B' }
            },
            series: [{ 
              name: '平均摄入量', 
              type: 'bar', 
              data: weeklyData.values, 
              itemStyle: { borderRadius: [4, 4, 0, 0] },
              barWidth: '50%'
            }],
            tooltip: {
              ...baseOption.tooltip,
              formatter: function(params) {
                const idx = params[0].dataIndex;
                return `
                  <div style="font-weight:600">${params[0].name}</div>
                  <div>平均摄入量: ${weeklyData.values[idx]} g</div>
                  <div>周总摄入量: ${weeklyData.totals[idx]} g</div>
                `;
              }
            }
          });
          break;
        }
        
        case 'waste_analysis': {
          // 计算浪费量 = 打饭量 - 摄入量
          const waste = served.map((s, i) => {
            const v = Number(s) - Number(intake[i] || 0);
            return v > 0 ? Number(v.toFixed(1)) : 0;
          });
          
          setOption({
            ...baseOption,
            color: ['#EF4444'],
            xAxis: { 
              type: 'category', 
              data: dates, 
              axisLine: { lineStyle: { color: '#E2E8F0' } }, 
              axisLabel: { color: '#64748B' } 
            },
            yAxis: { 
              type: 'value', 
              name: 'g', 
              splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } 
            },
            series: [{ 
              name: '浪费量', 
              type: 'line', 
              data: waste, 
              smooth: true, 
              areaStyle: { opacity: 0.1 } 
            }]
          });
          break;
        }
        
        case 'speed_analysis': {
          setOption({
            ...baseOption,
            color: ['#F59E0B'],
            xAxis: { 
              type: 'category', 
              data: dates, 
              axisLine: { lineStyle: { color: '#E2E8F0' } }, 
              axisLabel: { color: '#64748B' } 
            },
            yAxis: { 
              type: 'value', 
              name: 'g/min', 
              splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } } 
            },
            series: [{ 
              name: '平均速度', 
              type: 'line', 
              data: speeds, 
              smooth: true 
            }]
          });
          break;
        }
        
        case 'nutrition_pie': {
          // 限制饼图数据点数量，防止浏览器卡死
          const pieData = limitPieData(dates, calories, 7);
          
          setOption({
            tooltip: { 
              trigger: 'item', 
              backgroundColor: 'rgba(255, 255, 255, 0.9)', 
              borderColor: '#E2E8F0', 
              borderRadius: 8,
              formatter: function(params) {
                return `
                  <div style="font-weight:600">${params.name}</div>
                  <div>卡路里: ${params.value} kcal</div>
                  <div>占比: ${params.percent}%</div>
                `;
              }
            },
            legend: { 
              bottom: 0, 
              textStyle: { color: '#64748B' },
              type: 'scroll'
            },
            color: ['#00BFA5', '#4F46E5', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'],
            series: [{ 
              type: 'pie', 
              radius: ['40%', '70%'], 
              avoidLabelOverlap: true,
              itemStyle: { borderRadius: 8, borderColor: '#fff', borderWidth: 2 },
              label: { 
                show: true, 
                formatter: '{b}: {c}kcal',
                fontSize: 11
              },
              emphasis: { 
                label: { show: true, fontSize: 14, fontWeight: 'bold' } 
              },
              labelLine: { show: true },
              data: pieData 
            }]
          });
          break;
        }
        
        default:
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

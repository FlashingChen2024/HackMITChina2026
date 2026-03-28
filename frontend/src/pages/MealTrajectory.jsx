import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Alert,
  CircularProgress,
  Stack,
  TextField,
  MenuItem,
  Grid,
  Chip,
  Divider,
  FormControlLabel,
  Switch,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Timeline as TimelineIcon,
  Settings as SettingsIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import { fetchMeals, fetchMealTrajectory } from '../api/meals';
import ChartBlock from '../components/ChartBlock';

const SAMPLE_INTERVALS = [
  { value: 0, label: '原始数据' },
  { value: 5, label: '5秒降采样' },
  { value: 10, label: '10秒降采样' },
  { value: 30, label: '30秒降采样' },
  { value: 60, label: '1分钟降采样' },
];

const GRID_COLORS = {
  grid_1: '#00BFA5',
  grid_2: '#4F46E5',
  grid_3: '#F59E0B',
  grid_4: '#EF4444',
};

const GRID_LABELS = {
  grid_1: '分格1',
  grid_2: '分格2',
  grid_3: '分格3',
  grid_4: '分格4',
};

const MEALS_PAGE_SIZE = 10;

export default function MealTrajectory() {
  const { mealId: urlMealId } = useParams();
  const navigate = useNavigate();
  const [meals, setMeals] = useState([]);
  const [selectedMealId, setSelectedMealId] = useState(urlMealId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [trajectoryData, setTrajectoryData] = useState([]);
  const [chartOption, setChartOption] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [sampleInterval, setSampleInterval] = useState(0);
  const [lastTimestamp, setLastTimestamp] = useState(null);
  /** 增量拉轨迹用，避免放进 useCallback 依赖导致「全量 effect」反复触发、图表闪屏 */
  const lastTimestampRef = useRef(null);
  const refreshTimerRef = useRef(null);
  
  // 分页状态
  const [mealsCursor, setMealsCursor] = useState('');
  const [mealsHasMore, setMealsHasMore] = useState(false);
  const [mealsLoading, setMealsLoading] = useState(false);

  // 加载就餐列表（分页）
  const loadMeals = useCallback(async (cursor = '') => {
    setMealsLoading(true);
    try {
      const res = await fetchMeals({ limit: MEALS_PAGE_SIZE, cursor });
      const list = res.items || res.meals || [];
      const nextCursor = res.next_cursor || '';
      
      if (cursor) {
        // 加载更多，追加数据
        setMeals(prev => [...prev, ...list]);
      } else {
        // 首次加载，替换数据
        setMeals(list);
        // 如果有URL传入的mealId，检查是否在列表中
        if (urlMealId && list.length > 0) {
          const found = list.find(m => m.meal_id === urlMealId);
          if (!found && !selectedMealId) {
            // URL中的mealId不在当前页，先选中第一个
            setSelectedMealId(list[0].meal_id);
          } else if (found) {
            setSelectedMealId(urlMealId);
          }
        } else if (list.length > 0 && !selectedMealId) {
          setSelectedMealId(list[0].meal_id);
        }
      }
      
      setMealsCursor(nextCursor);
      setMealsHasMore(!!nextCursor);
    } catch (e) {
      setError('加载就餐记录失败: ' + (e.message || '未知错误'));
    } finally {
      setMealsLoading(false);
    }
  }, [urlMealId, selectedMealId]);

  useEffect(() => {
    loadMeals('');
  }, []);
  
  // 加载更多就餐记录
  const loadMoreMeals = () => {
    if (mealsCursor && !mealsLoading) {
      loadMeals(mealsCursor);
    }
  };

  // 加载轨迹数据
  const loadTrajectory = useCallback(async (isIncremental = false) => {
    if (!selectedMealId) return;

    if (!isIncremental) {
      lastTimestampRef.current = null;
    }

    if (!isIncremental) {
      setLoading(true);
    }
    setError('');
    try {
      const params = {
        sampleInterval: sampleInterval > 0 ? sampleInterval : undefined,
      };
      if (isIncremental && lastTimestampRef.current) {
        params.lastTimestamp = lastTimestampRef.current;
      }

      const res = await fetchMealTrajectory(selectedMealId, params);
      const items = res.items || [];

      if (isIncremental && items.length > 0) {
        setTrajectoryData(prev => [...prev, ...items]);
      } else {
        setTrajectoryData(items);
      }

      if (res.last_timestamp) {
        lastTimestampRef.current = res.last_timestamp;
        setLastTimestamp(res.last_timestamp);
      }
    } catch (e) {
      setError('加载轨迹数据失败: ' + (e.message || '未知错误'));
    } finally {
      if (!isIncremental) {
        setLoading(false);
      }
    }
  }, [selectedMealId, sampleInterval]);

  // 初始加载和切换就餐记录 / 降采样时全量加载（不依赖会随请求变化的回调形态）
  useEffect(() => {
    if (selectedMealId) {
      setLastTimestamp(null);
      lastTimestampRef.current = null;
      setTrajectoryData([]);
      loadTrajectory(false);
    }
  }, [selectedMealId, sampleInterval, loadTrajectory]);

  // 自动刷新
  useEffect(() => {
    if (autoRefresh && selectedMealId) {
      refreshTimerRef.current = setInterval(() => {
        loadTrajectory(true);
      }, 3000);
    }
    return () => {
      if (refreshTimerRef.current) {
        clearInterval(refreshTimerRef.current);
      }
    };
  }, [autoRefresh, selectedMealId, loadTrajectory]);

  // 更新图表
  useEffect(() => {
    if (trajectoryData.length === 0) {
      setChartOption({});
      return;
    }

    const timestamps = trajectoryData.map(item => {
      const date = new Date(item.timestamp);
      return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    });

    const series = Object.keys(GRID_COLORS).map(gridKey => ({
      name: GRID_LABELS[gridKey],
      type: 'line',
      data: trajectoryData.map(item => item.weights?.[gridKey] || 0),
      smooth: true,
      symbol: 'circle',
      symbolSize: 4,
      lineStyle: { width: 2 },
      itemStyle: { color: GRID_COLORS[gridKey] },
      areaStyle: { opacity: 0.05 },
    }));

    setChartOption({
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderColor: '#E2E8F0',
        borderRadius: 8,
        textStyle: { color: '#1E293B' },
        formatter: function(params) {
          let html = `<div style="font-weight:600;margin-bottom:4px">${params[0].axisValue}</div>`;
          params.forEach(p => {
            html += `<div style="display:flex;align-items:center;gap:6px">
              <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
              <span>${p.seriesName}: <strong>${p.value}g</strong></span>
            </div>`;
          });
          return html;
        }
      },
      legend: {
        data: Object.values(GRID_LABELS),
        bottom: 0,
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: '#64748B' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '12%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timestamps,
        axisLine: { lineStyle: { color: '#E2E8F0' } },
        axisLabel: { color: '#64748B', fontSize: 11 },
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '重量 (g)',
        nameTextStyle: { color: '#64748B' },
        splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } },
        axisLabel: { color: '#64748B' },
      },
      series,
      dataZoom: isPlaying ? undefined : [
        {
          type: 'inside',
          start: 0,
          end: 100,
        },
        {
          type: 'slider',
          start: 0,
          end: 100,
          height: 20,
          bottom: 35,
          borderColor: '#E2E8F0',
          fillerColor: 'rgba(0, 191, 165, 0.1)',
          handleStyle: { color: '#00BFA5' },
        }
      ],
    });
  }, [trajectoryData, isPlaying]);

  const handleMealChange = (mealId) => {
    setSelectedMealId(mealId);
    // Update URL if navigating from /trajectory
    if (!urlMealId && mealId) {
      navigate(`/meals/${mealId}/trajectory`, { replace: true });
    }
  };

  const handleRefresh = () => {
    setLastTimestamp(null);
    lastTimestampRef.current = null;
    loadTrajectory(false);
  };

  const togglePlayback = () => {
    setIsPlaying(!isPlaying);
  };

  const selectedMeal = meals.find(m => m.meal_id === selectedMealId);

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>
            实时就餐轨迹
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            可视化展示就餐过程中各分格重量的时序变化，支持实时增量更新与降采样
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Tooltip title="刷新数据">
            <IconButton onClick={handleRefresh} disabled={loading} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* 控制面板 */}
        <Grid item xs={12} md={3}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <SettingsIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  设置
                </Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />

              <Stack spacing={2.5}>
                <Box>
                  <TextField
                    select
                    label="选择就餐记录"
                    value={selectedMealId}
                    onChange={(e) => handleMealChange(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={mealsLoading && meals.length === 0}
                  >
                    {meals.map((meal) => (
                      <MenuItem key={meal.meal_id} value={meal.meal_id}>
                        {new Date(meal.start_time).toLocaleString('zh-CN')}
                      </MenuItem>
                    ))}
                  </TextField>
                  
                  {/* 分页控制 */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      已加载 {meals.length} 条记录
                    </Typography>
                    <Button
                      size="small"
                      onClick={loadMoreMeals}
                      disabled={!mealsHasMore || mealsLoading}
                      endIcon={mealsLoading ? <CircularProgress size={12} /> : <NextIcon />}
                      sx={{ fontSize: '0.75rem' }}
                    >
                      {mealsLoading ? '加载中...' : mealsHasMore ? '加载更多' : '没有更多了'}
                    </Button>
                  </Box>
                </Box>

                {selectedMeal && (
                  <Box sx={{ p: 1.5, bgcolor: '#F8FAFC', borderRadius: 2 }}>
                    <Typography variant="caption" color="text.secondary">开始时间</Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {new Date(selectedMeal.start_time).toLocaleString('zh-CN')}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      持续时长
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {selectedMeal.duration_minutes || 0} 分钟
                    </Typography>
                  </Box>
                )}

                <TextField
                  select
                  label="降采样间隔"
                  value={sampleInterval}
                  onChange={(e) => setSampleInterval(Number(e.target.value))}
                  fullWidth
                  size="small"
                  helperText="减少数据点数以优化图表性能"
                >
                  {SAMPLE_INTERVALS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>

                <FormControlLabel
                  control={
                    <Switch
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                      color="primary"
                    />
                  }
                  label="自动刷新 (3秒)"
                />

                <Button
                  variant="contained"
                  fullWidth
                  startIcon={isPlaying ? <PauseIcon /> : <PlayIcon />}
                  onClick={togglePlayback}
                  disabled={trajectoryData.length === 0}
                  sx={{ borderRadius: 2 }}
                >
                  {isPlaying ? '暂停回放' : '开始回放'}
                </Button>

                <Alert severity="info" sx={{ fontSize: '0.75rem' }}>
                  共 {trajectoryData.length} 个数据点
                  {lastTimestamp && ' · 支持增量更新'}
                </Alert>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* 图表区域 */}
        <Grid item xs={12} md={9}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <TimelineIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  重量变化轨迹
                </Typography>
                {loading && <CircularProgress size={16} sx={{ ml: 1 }} />}
              </Stack>
              <Divider sx={{ mb: 2 }} />

              {trajectoryData.length === 0 && !loading ? (
                <Box sx={{ py: 10, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    暂无轨迹数据，请选择就餐记录
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ width: '100%', height: 450 }}>
                  <ChartBlock option={chartOption} loading={loading} />
                </Box>
              )}

              {/* 图例说明 */}
              <Box sx={{ mt: 2, display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'center' }}>
                {Object.entries(GRID_COLORS).map(([key, color]) => (
                  <Chip
                    key={key}
                    size="small"
                    label={GRID_LABELS[key]}
                    sx={{
                      bgcolor: color + '20',
                      color: color,
                      fontWeight: 600,
                      border: `1px solid ${color}40`,
                    }}
                  />
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 数据详情 */}
      {trajectoryData.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
              最新数据点
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
              {(() => {
                const latest = trajectoryData[trajectoryData.length - 1];
                if (!latest) return null;
                return (
                  <>
                    <Chip
                      label={`时间: ${new Date(latest.timestamp).toLocaleTimeString('zh-CN')}`}
                      variant="outlined"
                    />
                    {Object.entries(latest.weights || {}).map(([grid, weight]) => (
                      <Chip
                        key={grid}
                        label={`${GRID_LABELS[grid]}: ${weight}g`}
                        sx={{
                          bgcolor: GRID_COLORS[grid] + '15',
                          color: GRID_COLORS[grid],
                          fontWeight: 500,
                        }}
                      />
                    ))}
                  </>
                );
              })()}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

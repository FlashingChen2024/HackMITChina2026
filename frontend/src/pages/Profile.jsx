import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Avatar,
  Grid,
  Chip,
  Button,
  TextField,
  MenuItem,
  ToggleButton,
  ToggleButtonGroup,
  Divider,
  CircularProgress,
  Alert,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Edit as EditIcon,
  Save as SaveIcon,
  Refresh as RefreshIcon,
  DevicesOther as DeviceIcon,
  CheckCircle as OnlineIcon,
  Cancel as OfflineIcon,
  TrendingUp as TrendIcon,
  Lightbulb as BulbIcon,
  CalendarToday as CalendarIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import * as echarts from 'echarts';
import { fetchProfile, updateProfile, normalizeProfilePayload } from '../api/profile';
import { fetchChartData } from '../api/charts';
import { fetchAiAdvice } from '../api/report';
import { listBindings } from '../api/devices';
import { getCurrentUser } from '../api/client';

const GENDER_OPTIONS = [
  { value: 'male', label: '男', icon: '♂' },
  { value: 'female', label: '女', icon: '♀' },
  { value: 'other', label: '其他', icon: '○' },
];

const GENDER_LABEL = {
  male: '男',
  female: '女',
  other: '其他',
};

// 计算BMR（基础代谢率）
function calcBMR({ gender, age, height_cm, weight_kg }) {
  if (!age || !height_cm || !weight_kg) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === 'female') return Math.round(base - 161);
  if (gender === 'male') return Math.round(base + 5);
  return Math.round(base - 78);
}

// 计算BMI
function calcBMI(height_cm, weight_kg) {
  if (!height_cm || !weight_kg) return null;
  const height_m = height_cm / 100;
  return (weight_kg / (height_m * height_m)).toFixed(1);
}

// 获取日期范围
function getDateRange(type) {
  const end = new Date();
  const start = new Date();
  if (type === 'day') {
    start.setDate(end.getDate() - 7); // 最近7天
  } else {
    start.setMonth(end.getMonth() - 6); // 最近6个月
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // 用户数据
  const [profile, setProfile] = useState(null);
  const [devices, setDevices] = useState([]);
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    gender: 'male',
    age: '',
    height_cm: '',
    weight_kg: '',
  });
  const [saving, setSaving] = useState(false);

  // 图表数据
  const [chartType, setChartType] = useState('day'); // 'day' | 'month'
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  // AI建议
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // 加载所有数据
  const loadData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    setError('');
    try {
      const [profileRes, devicesRes] = await Promise.all([
        fetchProfile().catch(() => null),
        listBindings(),
      ]);

      if (profileRes) {
        const normalized = normalizeProfilePayload(profileRes);
        setProfile(normalized);
        setEditForm({
          gender: normalized.gender || 'male',
          age: normalized.age?.toString() || '',
          height_cm: normalized.height_cm?.toString() || '',
          weight_kg: normalized.weight_kg?.toString() || '',
        });
      }

      setDevices(devicesRes.devices || []);
    } catch (err) {
      setError(err.message || '加载数据失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // 加载图表数据
  const loadChartData = useCallback(async () => {
    setChartLoading(true);
    try {
      const { start, end } = getDateRange(chartType);
      const res = await fetchChartData({ start_date: start, end_date: end });
      
      // 转换为图表格式
      const data = res.chart_data?.dates?.map((date, i) => ({
        date,
        calories: res.chart_data.daily_calories?.[i] || 0,
        intake: res.chart_data.daily_intake_g?.[i] || 0,
        served: res.chart_data.daily_served_g?.[i] || 0,
        speed: res.chart_data.avg_speed_g_per_min?.[i] || 0,
      })) || [];
      
      setChartData(data);
    } catch (err) {
      console.error('加载图表失败:', err);
    } finally {
      setChartLoading(false);
    }
  }, [chartType]);

  // 加载AI建议
  const loadAiAdvice = useCallback(async () => {
    setAiLoading(true);
    try {
      const [dailyAlert, nextMeal] = await Promise.all([
        fetchAiAdvice({ type: 'daily_alert' }).catch(() => null),
        fetchAiAdvice({ type: 'next_meal' }).catch(() => null),
      ]);
      setAiAdvice({
        daily: dailyAlert,
        next: nextMeal,
      });
    } catch (err) {
      console.error('加载AI建议失败:', err);
    } finally {
      setAiLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (!loading) {
      loadChartData();
      loadAiAdvice();
    }
  }, [loading, chartType, loadChartData, loadAiAdvice]);

  // 初始化 ECharts
  useEffect(() => {
    if (chartRef.current && !chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(chartRef.current);
    }
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  // 更新图表数据
  useEffect(() => {
    if (chartInstanceRef.current && chartData.length > 0) {
      const option = {
        grid: { top: 40, right: 20, bottom: 20, left: 50, containLabel: true },
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'white',
          borderColor: '#E2E8F0',
          borderWidth: 1,
          textStyle: { color: '#1E293B' },
        },
        legend: { data: ['卡路里 (kcal)', '摄入量 (g)'], top: 0 },
        xAxis: {
          type: 'category',
          data: chartData.map(d => d.date),
          axisLine: { lineStyle: { color: '#E2E8F0' } },
          axisLabel: { color: '#64748B', fontSize: 11 },
        },
        yAxis: {
          type: 'value',
          axisLine: { show: false },
          splitLine: { lineStyle: { color: '#E2E8F0', type: 'dashed' } },
          axisLabel: { color: '#64748B', fontSize: 11 },
        },
        series: [
          {
            name: '卡路里 (kcal)',
            type: 'line',
            data: chartData.map(d => d.calories),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#00BFA5', width: 2 },
            itemStyle: { color: '#00BFA5' },
          },
          {
            name: '摄入量 (g)',
            type: 'line',
            data: chartData.map(d => d.intake),
            smooth: true,
            symbol: 'circle',
            symbolSize: 6,
            lineStyle: { color: '#3B82F6', width: 2 },
            itemStyle: { color: '#3B82F6' },
          },
        ],
      };
      chartInstanceRef.current.setOption(option);
    }
  }, [chartData]);

  // 窗口大小变化时重新调整图表
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 保存个人数据
  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        gender: editForm.gender,
        age: parseInt(editForm.age, 10),
        height_cm: parseFloat(editForm.height_cm),
        weight_kg: parseFloat(editForm.weight_kg),
      };
      await updateProfile(payload);
      setProfile({
        ...profile,
        ...payload,
        user_id: profile?.user_id || currentUser?.userId,
      });
      setEditOpen(false);
    } catch (err) {
      setError(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  // 计算统计数据
  const bmr = useMemo(() => calcBMR(profile || {}), [profile]);
  const bmi = useMemo(() => calcBMI(profile?.height_cm, profile?.weight_kg), [profile]);

  // BMI评级
  const getBmiLevel = (bmi) => {
    if (!bmi) return null;
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: '偏瘦', color: '#F59E0B' };
    if (val < 24) return { label: '正常', color: '#10B981' };
    if (val < 28) return { label: '偏胖', color: '#F97316' };
    return { label: '肥胖', color: '#EF4444' };
  };
  const bmiLevel = getBmiLevel(bmi);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: '#00BFA5' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4 }}>
      {/* 顶部标题 */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B' }}>
          个人数据
        </Typography>
        <IconButton onClick={() => loadData(true)} disabled={refreshing}>
          <RefreshIcon sx={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
        </IconButton>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* 第一行：三个信息卡 */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* 头像卡 */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Avatar
                sx={{
                  width: 80,
                  height: 80,
                  fontSize: '2rem',
                  fontWeight: 'bold',
                  bgcolor: 'primary.main',
                  mb: 2,
                  boxShadow: '0 4px 12px rgba(0, 191, 165, 0.3)',
                }}
              >
                {currentUser?.username?.[0]?.toUpperCase() || 'U'}
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                {currentUser?.username || '用户'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                ID: {currentUser?.userId?.slice(0, 8) || '---'}
              </Typography>
              <Chip
                size="small"
                label={GENDER_LABEL[profile?.gender] || '未设置性别'}
                sx={{
                  bgcolor: profile?.gender === 'female' ? '#FDF2F8' : profile?.gender === 'male' ? '#EFF6FF' : '#F3F4F6',
                  color: profile?.gender === 'female' ? '#EC4899' : profile?.gender === 'male' ? '#3B82F6' : '#6B7280',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* 个人数据卡 */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  健康数据
                </Typography>
                <IconButton size="small" onClick={() => setEditOpen(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              
              {profile?.age ? (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>年龄</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile.age} <small>岁</small></Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>身高</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile.height_cm} <small>cm</small></Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>体重</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile.weight_kg} <small>kg</small></Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>BMI</Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700 }}>{bmi || '--'}</Typography>
                        {bmiLevel && (
                          <Chip size="small" label={bmiLevel.label} sx={{ bgcolor: bmiLevel.color + '20', color: bmiLevel.color, height: 20 }} />
                        )}
                      </Box>
                    </Grid>
                  </Grid>
                  {bmr && (
                    <Box sx={{ p: 1.5, bgcolor: 'rgba(0,191,165,0.08)', borderRadius: 2 }}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>基础代谢 (BMR)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {bmr} <small>kcal/天</small>
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                    尚未填写健康数据
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setEditOpen(true)}>
                    立即填写
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 设备连接状态卡 */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  设备状态
                </Typography>
                <DeviceIcon sx={{ color: '#64748B' }} />
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: devices.length > 0 ? 'primary.main' : '#94A3B8' }}>
                  {devices.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  已绑定设备
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {devices.slice(0, 3).map((device, idx) => (
                  <Box key={idx} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <OnlineIcon sx={{ fontSize: 16, color: '#10B981' }} />
                    <Typography variant="body2" noWrap sx={{ flex: 1 }}>
                      {device}
                    </Typography>
                  </Box>
                ))}
                {devices.length === 0 && (
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: '#94A3B8' }}>
                    <OfflineIcon sx={{ fontSize: 16 }} />
                    <Typography variant="body2">暂无绑定设备</Typography>
                  </Box>
                )}
                {devices.length > 3 && (
                  <Typography variant="caption" sx={{ color: '#64748B', pl: 3 }}>
                    还有 {devices.length - 3} 个设备...
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 第二行：日/月图表 */}
      <Card sx={{ mb: 3, borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                饮食趋势
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(e, val) => val && setChartType(val)}
              size="small"
              sx={{ bgcolor: '#F1F5F9', p: 0.5, borderRadius: 2 }}
            >
              <ToggleButton value="day" sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}>
                <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
                日
              </ToggleButton>
              <ToggleButton value="month" sx={{ borderRadius: 1.5, textTransform: 'none', px: 2 }}>
                月
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {chartLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={40} sx={{ color: '#00BFA5' }} />
            </Box>
          ) : chartData.length > 0 ? (
            <Box ref={chartRef} sx={{ height: 280, width: '100%' }} />
          ) : (
            <Box sx={{ textAlign: 'center', py: 8, bgcolor: '#F8FAFC', borderRadius: 2 }}>
              <ChartIcon sx={{ fontSize: 48, color: '#94A3B8', mb: 2 }} />
              <Typography variant="body1" sx={{ color: '#475569', fontWeight: 500, mb: 1 }}>
                暂无饮食数据
              </Typography>
              <Typography variant="body2" sx={{ color: '#94A3B8' }}>
                开始记录用餐后，这里将显示您的饮食趋势图表
              </Typography>
            </Box>
          )}
        </CardContent>
      </Card>

      {/* 第三行：AI报告和建议 */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BulbIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  每日健康提醒
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {aiLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: '#00BFA5' }} />
                </Box>
              ) : aiAdvice?.daily ? (
                <Box>
                  <Typography variant="body1" sx={{ lineHeight: 1.8, color: '#1E293B', whiteSpace: 'pre-wrap' }}>
                    {aiAdvice.daily.advice}
                  </Typography>
                  {aiAdvice.daily.is_alert && (
                    <Chip
                      size="small"
                      label="健康预警"
                      sx={{ mt: 2, bgcolor: '#FEE2E2', color: '#DC2626' }}
                    />
                  )}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  暂无今日提醒，请保持规律用餐
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', borderRadius: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BulbIcon sx={{ color: '#8B5CF6' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  下一餐建议
                </Typography>
              </Box>
              <Divider sx={{ mb: 2 }} />
              {aiLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress size={24} sx={{ color: '#00BFA5' }} />
                </Box>
              ) : aiAdvice?.next ? (
                <Typography variant="body1" sx={{ lineHeight: 1.8, color: '#1E293B', whiteSpace: 'pre-wrap' }}>
                  {aiAdvice.next.advice}
                </Typography>
              ) : (
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  正在分析您的饮食习惯，建议即将生成...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 编辑个人数据弹窗 */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>编辑健康数据</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="性别"
              value={editForm.gender}
              onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
              fullWidth
            >
              {GENDER_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.icon} {o.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="年龄"
              type="number"
              value={editForm.age}
              onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
              fullWidth
              inputProps={{ min: 1, max: 120 }}
            />
            <TextField
              label="身高 (cm)"
              type="number"
              value={editForm.height_cm}
              onChange={(e) => setEditForm({ ...editForm, height_cm: e.target.value })}
              fullWidth
              inputProps={{ min: 50, max: 260, step: 0.1 }}
            />
            <TextField
              label="体重 (kg)"
              type="number"
              value={editForm.weight_kg}
              onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })}
              fullWidth
              inputProps={{ min: 20, max: 300, step: 0.1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)}>取消</Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

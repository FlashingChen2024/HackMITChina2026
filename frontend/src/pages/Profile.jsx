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
  { value: 'male', label: 'Male', icon: '♂' },
  { value: 'female', label: 'Female', icon: '♀' },
  { value: 'other', label: 'Other', icon: '○' },
];

const GENDER_LABEL = {
  male: 'Male',
  female: 'Female',
  other: 'Other',
};

// Calculate BMR (Basal Metabolic Rate)
function calcBMR({ gender, age, height_cm, weight_kg }) {
  if (!age || !height_cm || !weight_kg) return null;
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === 'female') return Math.round(base - 161);
  if (gender === 'male') return Math.round(base + 5);
  return Math.round(base - 78);
}

// Calculate BMI
function calcBMI(height_cm, weight_kg) {
  if (!height_cm || !weight_kg) return null;
  const height_m = height_cm / 100;
  return (weight_kg / (height_m * height_m)).toFixed(1);
}

// Get date range
function getDateRange(type) {
  const end = new Date();
  const start = new Date();
  if (type === 'day') {
    start.setDate(end.getDate() - 7); // Last 7 days
  } else {
    start.setMonth(end.getMonth() - 6); // Last 6 months
  }
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
  };
}

/**
 * Whether there is chartable diet trend data.
 *
 * @param {Array<{ calories?: number, intake?: number, served?: number }>} rows
 * @returns {boolean}
 */
function trendRowsHavePlottableData(rows) {
  if (!rows?.length) return false;
  return rows.some((d) => {
    const c = Number(d.calories);
    const i = Number(d.intake);
    const s = Number(d.served);
    return (Number.isFinite(c) && c > 0)
      || (Number.isFinite(i) && i > 0)
      || (Number.isFinite(s) && s > 0);
  });
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  // User data
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

  // Chart data
  const [chartType, setChartType] = useState('day'); // 'day' | 'month'
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [chartError, setChartError] = useState('');
  const chartRef = useRef(null);
  const chartInstanceRef = useRef(null);

  const trendHasPlottableData = useMemo(
    () => trendRowsHavePlottableData(chartData),
    [chartData],
  );

  // AI advice
  const [aiAdvice, setAiAdvice] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Load all data
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
      setError(err.message || 'Failed to load data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Load chart data
  const loadChartData = useCallback(async () => {
    setChartLoading(true);
    setChartError('');
    try {
      const { start, end } = getDateRange(chartType);
      const res = await fetchChartData({ start_date: start, end_date: end });
      
      // Transform to chart format
      const data = res.chart_data?.dates?.map((date, i) => ({
        date,
        calories: res.chart_data.daily_calories?.[i] || 0,
        intake: res.chart_data.daily_intake_g?.[i] || 0,
        served: res.chart_data.daily_served_g?.[i] || 0,
        speed: res.chart_data.avg_speed_g_per_min?.[i] || 0,
      })) || [];
      
      setChartData(data);
    } catch (err) {
      console.error('Failed to load chart:', err);
      setChartData([]);
      setChartError(err?.message || 'Failed to load diet trend. Please try again later.');
    } finally {
      setChartLoading(false);
    }
  }, [chartType]);

  // Load AI advice
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
      console.error('Failed to load AI advice:', err);
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

  useEffect(() => {
    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
    };
  }, []);

  /**
   * Initialize the chart only after ref is mounted and data is available.
   */
  useEffect(() => {
    if (chartLoading || !trendHasPlottableData) {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.dispose();
        chartInstanceRef.current = null;
      }
      return;
    }

    const el = chartRef.current;
    if (!el) return;

    if (!chartInstanceRef.current) {
      chartInstanceRef.current = echarts.init(el);
    }

    const option = {
      grid: { top: 40, right: 20, bottom: 20, left: 50, containLabel: true },
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#E2E8F0',
        borderWidth: 1,
        borderRadius: 8,
        textStyle: { color: '#1E293B' },
      },
      legend: { data: ['Calories (kcal)', 'Intake (g)'], top: 0 },
      xAxis: {
        type: 'category',
        data: chartData.map((d) => d.date),
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
          name: 'Calories (kcal)',
          type: 'line',
          data: chartData.map((d) => d.calories),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#00BFA5', width: 2 },
          itemStyle: { color: '#00BFA5' },
        },
        {
          name: 'Intake (g)',
          type: 'line',
          data: chartData.map((d) => d.intake),
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: '#3B82F6', width: 2 },
          itemStyle: { color: '#3B82F6' },
        },
      ],
    };
    chartInstanceRef.current.setOption(option);
    requestAnimationFrame(() => chartInstanceRef.current?.resize());
  }, [chartData, chartLoading, trendHasPlottableData]);

  // Resize chart on window size changes
  useEffect(() => {
    const handleResize = () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.resize();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Save personal data
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
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  // Calculate stats
  const bmr = useMemo(() => calcBMR(profile || {}), [profile]);
  const bmi = useMemo(() => calcBMI(profile?.height_cm, profile?.weight_kg), [profile]);

  // BMI level
  const getBmiLevel = (bmi) => {
    if (!bmi) return null;
    const val = parseFloat(bmi);
    if (val < 18.5) return { label: 'Underweight', color: '#F59E0B' };
    if (val < 24) return { label: 'Normal', color: '#10B981' };
    if (val < 28) return { label: 'Overweight', color: '#F97316' };
    return { label: 'Obese', color: '#EF4444' };
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
      {/* Header */}
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B' }}>
          Personal Data
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

      {/* Row 1: three info cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {/* Avatar card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
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
                {currentUser?.username || 'User'}
              </Typography>
              <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                ID: {currentUser?.userId?.slice(0, 8) || '---'}
              </Typography>
              <Chip
                size="small"
                label={GENDER_LABEL[profile?.gender] || 'Gender not set'}
                sx={{
                  bgcolor: profile?.gender === 'female' ? '#FDF2F8' : profile?.gender === 'male' ? '#EFF6FF' : '#F3F4F6',
                  color: profile?.gender === 'female' ? '#EC4899' : profile?.gender === 'male' ? '#3B82F6' : '#6B7280',
                }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Personal data card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Health Data
                </Typography>
                <IconButton size="small" onClick={() => setEditOpen(true)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Box>
              
              {profile?.age ? (
                <>
                  <Grid container spacing={2} sx={{ mb: 2 }}>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Age</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile.age} <small>yrs</small></Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Height</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700 }}>{profile.height_cm} <small>cm</small></Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Weight</Typography>
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
                    <Box sx={{ p: 1.5, bgcolor: 'rgba(0,191,165,0.08)', borderRadius: '12px' }}>
                      <Typography variant="caption" sx={{ color: '#64748B' }}>Basal Metabolic Rate (BMR)</Typography>
                      <Typography variant="h6" sx={{ fontWeight: 700, color: 'primary.main' }}>
                        {bmr} <small>kcal/day</small>
                      </Typography>
                    </Box>
                  )}
                </>
              ) : (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
                    Health data is not filled yet
                  </Typography>
                  <Button variant="outlined" size="small" onClick={() => setEditOpen(true)}>
                    Fill Now
                  </Button>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Device status card */}
        <Grid item xs={12} sm={4}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                  Device Status
                </Typography>
                <DeviceIcon sx={{ color: '#64748B' }} />
              </Box>
              
              <Box sx={{ mb: 3 }}>
                <Typography variant="h3" sx={{ fontWeight: 800, color: devices.length > 0 ? 'primary.main' : '#94A3B8' }}>
                  {devices.length}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  Connected Devices
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
                    <Typography variant="body2">No connected devices</Typography>
                  </Box>
                )}
                {devices.length > 3 && (
                  <Typography variant="caption" sx={{ color: '#64748B', pl: 3 }}>
                    {devices.length - 3} more devices...
                  </Typography>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 2: day/month chart */}
      <Card sx={{ mb: 3, boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendIcon sx={{ color: 'primary.main' }} />
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Diet Trend
              </Typography>
            </Box>
            <ToggleButtonGroup
              value={chartType}
              exclusive
              onChange={(e, val) => val && setChartType(val)}
              size="small"
              sx={{ bgcolor: '#F1F5F9', p: 0.5, borderRadius: '12px' }}
            >
              <ToggleButton value="day" sx={{ borderRadius: '10px', textTransform: 'none', px: 2 }}>
                <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
                Day
              </ToggleButton>
              <ToggleButton value="month" sx={{ borderRadius: '10px', textTransform: 'none', px: 2 }}>
                Month
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>

          {chartLoading ? (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                py: 8,
                bgcolor: '#F8FAFC',
                borderRadius: '12px',
              }}
            >
              <CircularProgress size={40} sx={{ color: '#00BFA5' }} />
              <Typography variant="body2" sx={{ color: '#64748B' }}>
                Loading diet trend...
              </Typography>
            </Box>
          ) : chartError ? (
            <Alert
              severity="error"
              sx={{ borderRadius: '12px' }}
              action={
                <Button color="inherit" size="small" onClick={() => loadChartData()}>
                  Retry
                </Button>
              }
            >
              {chartError}
            </Alert>
          ) : !trendHasPlottableData ? (
            <Alert severity="info" icon={<ChartIcon fontSize="inherit" />} sx={{ borderRadius: '12px' }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                No diet trend data in the current period
              </Typography>
              <Typography variant="body2" component="span" sx={{ color: 'text.secondary', display: 'block' }}>
                The page is not stuck. There are simply no valid calorie or intake records in the selected Day/Month range.
              </Typography>
            </Alert>
          ) : (
            <Box ref={chartRef} sx={{ height: 280, width: '100%' }} />
          )}
        </CardContent>
      </Card>

      {/* Row 3: AI reports and suggestions */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BulbIcon sx={{ color: '#F59E0B' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Daily Health Reminder
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
                      label="Health Alert"
                      sx={{ mt: 2, bgcolor: '#FEE2E2', color: '#DC2626' }}
                    />
                  )}
                </Box>
              ) : (
                <Typography variant="body2" sx={{ color: '#64748B' }}>
                  No reminder for today. Keep a regular meal schedule.
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', boxShadow: '0 2px 12px rgba(0,0,0,0.06)' }}>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BulbIcon sx={{ color: '#8B5CF6' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Next Meal Suggestion
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
                  Analyzing your eating habits. Suggestions will appear soon...
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Edit personal data dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Health Data</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              select
              label="Gender"
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
              label="Age"
              type="number"
              value={editForm.age}
              onChange={(e) => setEditForm({ ...editForm, age: e.target.value })}
              fullWidth
              inputProps={{ min: 1, max: 120 }}
            />
            <TextField
              label="Height (cm)"
              type="number"
              value={editForm.height_cm}
              onChange={(e) => setEditForm({ ...editForm, height_cm: e.target.value })}
              fullWidth
              inputProps={{ min: 50, max: 260, step: 0.1 }}
            />
            <TextField
              label="Weight (kg)"
              type="number"
              value={editForm.weight_kg}
              onChange={(e) => setEditForm({ ...editForm, weight_kg: e.target.value })}
              fullWidth
              inputProps={{ min: 20, max: 300, step: 0.1 }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleSaveProfile}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={16} /> : <SaveIcon />}
          >
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

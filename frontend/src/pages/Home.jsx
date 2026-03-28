import { useEffect, useState } from 'react';
import { Box, Typography, Avatar, Card, CardContent, LinearProgress, Grid, Chip } from '@mui/material';
import { AccessTime, Speed, Restaurant } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals } from '../api/meals';
import { listBindings } from '../api/devices';

// 计算进食进度 (intake / served * 100)
function calcProgress(served, intake) {
  if (!served || served <= 0) return 0;
  const progress = (intake / served) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

// 格式化时间差
function formatDuration(startTime) {
  if (!startTime) return '0分钟';
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}天${diffHours % 24}小时`;
  if (diffHours > 0) return `${diffHours}小时${diffMins % 60}分钟`;
  return `${diffMins}分钟`;
}

// 餐盒格子颜色
const GRID_COLORS = [
  { bg: '#FEE2E2', bar: '#EF4444', text: '#991B1B' },   // 红
  { bg: '#DBEAFE', bar: '#3B82F6', text: '#1E40AF' },   // 蓝
  { bg: '#D1FAE5', bar: '#10B981', text: '#065F46' },   // 绿
  { bg: '#FEF3C7', bar: '#F59E0B', text: '#92400E' },   // 黄
];

export default function Home() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [latestMeal, setLatestMeal] = useState(null);
  const [devices, setDevices] = useState([]);
  const [stats, setStats] = useState({
    totalTime: '',
    avgSpeed: 0,
  });

  useEffect(() => {
    /**
     * @param {{ silent?: boolean }} opts 定时刷新时不显示全页 loading，避免数字与进度条周期性闪动
     */
    async function loadData(opts = {}) {
      const silent = !!opts.silent;
      try {
        if (!silent) setLoading(true);

        const [devicesRes, mealsRes] = await Promise.all([
          listBindings(),
          fetchMeals({ limit: 1 }),
        ]);

        setDevices(devicesRes.devices || []);

        if (mealsRes.items && mealsRes.items.length > 0) {
          const latest = mealsRes.items[0];
          setLatestMeal(latest);

          if (latest.start_time) {
            setStats({
              totalTime: formatDuration(latest.start_time),
              avgSpeed: latest.avg_speed_g_per_min || 0,
            });
          }
        }
      } catch (err) {
        console.error('加载首页数据失败:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    }

    loadData({ silent: false });

    const timer = setInterval(() => loadData({ silent: true }), 30000);
    return () => clearInterval(timer);
  }, []);

  // 生成四个格子的数据
  const gridData = [1, 2, 3, 4].map((index) => {
    const detail = latestMeal?.grid_details?.find(g => g.grid_index === index);
    const served = detail?.served_g || 0;
    const intake = detail?.intake_g || 0;
    const foodName = detail?.food_name || `餐格 ${index}`;
    const progress = calcProgress(served, intake);
    
    return {
      index,
      foodName,
      served,
      intake,
      progress,
      color: GRID_COLORS[index - 1],
    };
  });

  return (
    <Box sx={{ pb: 4 }}>
      {/* 第一行：头像 + 用户名 */}
      <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Avatar
          sx={{
            width: 64,
            height: 64,
            bgcolor: 'primary.main',
            fontSize: '1.5rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 12px rgba(0, 191, 165, 0.3)',
          }}
        >
          {currentUser?.username?.[0]?.toUpperCase() || 'U'}
        </Avatar>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B' }}>
            {currentUser?.username || '用户'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            欢迎回来，祝您用餐愉快
          </Typography>
        </Box>
      </Box>

      {/* 第二行：共处时间 + 进食速度 */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)',
          color: 'white',
          borderRadius: 3,
          boxShadow: '0 8px 24px rgba(0, 191, 165, 0.25)',
        }}
      >
        <CardContent sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AccessTime sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>
                    您已经和餐盒共处
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {loading ? '---' : stats.totalTime || '暂无记录'}
                  </Typography>
                </Box>
              </Box>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: '12px',
                    bgcolor: 'rgba(255,255,255,0.2)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Speed sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 0.5 }}>
                    您的进食速度
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {loading ? '---' : `${stats.avgSpeed.toFixed(1)} g/min`}
                  </Typography>
                </Box>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* 四个餐盒进度卡 */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Restaurant sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>
          餐盒用餐进度
        </Typography>
        {devices.length > 0 && (
          <Chip
            size="small"
            label={`已绑定 ${devices.length} 个设备`}
            sx={{ ml: 'auto', bgcolor: 'rgba(0, 191, 165, 0.1)', color: 'primary.main' }}
          />
        )}
      </Box>

      <Grid container spacing={2}>
        {gridData.map((grid) => (
          <Grid item xs={12} sm={6} key={grid.index}>
            <Card
              sx={{
                height: '100%',
                borderRadius: 3,
                bgcolor: grid.color.bg,
                border: 'none',
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': {
                  transform: 'translateY(-2px)',
                  boxShadow: '0 8px 16px rgba(0,0,0,0.08)',
                },
              }}
            >
              <CardContent sx={{ p: 2.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontWeight: 700, color: grid.color.text }}
                  >
                    {grid.foodName}
                  </Typography>
                  <Typography
                    variant="h6"
                    sx={{ fontWeight: 800, color: grid.color.text }}
                  >
                    {grid.progress.toFixed(0)}%
                  </Typography>
                </Box>

                {/* 进度条 */}
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={grid.progress}
                    sx={{
                      height: 12,
                      borderRadius: 6,
                      bgcolor: 'rgba(255,255,255,0.5)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 6,
                        bgcolor: grid.color.bar,
                        transition: 'transform 0.5s ease',
                      },
                    }}
                  />
                </Box>

                {/* 数据详情 */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: grid.color.text, opacity: 0.8 }}>
                    已吃: {grid.intake}g
                  </Typography>
                  <Typography variant="caption" sx={{ color: grid.color.text, opacity: 0.8 }}>
                    总量: {grid.served}g
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* 无数据提示 */}
      {!loading && !latestMeal && (
        <Card
          sx={{
            mt: 3,
            p: 4,
            textAlign: 'center',
            borderRadius: 3,
            bgcolor: '#F8FAFC',
            border: '1px dashed #CBD5E1',
          }}
        >
          <Typography variant="body1" sx={{ color: '#64748B', mb: 1 }}>
            暂无用餐记录
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            开始您的第一餐，数据将自动同步到这里
          </Typography>
        </Card>
      )}
    </Box>
  );
}

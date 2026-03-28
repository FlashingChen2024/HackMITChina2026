import { useEffect, useState } from 'react';
import { Box, Typography, Avatar, Card, CardContent, LinearProgress, Grid, Chip } from '@mui/material';
import { AccessTime, Speed, Restaurant } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals } from '../api/meals';
import { listBindings } from '../api/devices';

// Calculate meal progress (intake / served * 100)
function calcProgress(served, intake) {
  if (!served || served <= 0) return 0;
  const progress = (intake / served) * 100;
  return Math.min(Math.max(progress, 0), 100);
}

// Format elapsed time
function formatDuration(startTime) {
  if (!startTime) return '0 min';
  const start = new Date(startTime);
  const now = new Date();
  const diffMs = now - start;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  
  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h ${diffMins % 60}min`;
  return `${diffMins}min`;
}

// Grid color palette
const GRID_COLORS = [
  { bg: '#FEE2E2', bar: '#EF4444', text: '#991B1B' },   // Red
  { bg: '#DBEAFE', bar: '#3B82F6', text: '#1E40AF' },   // Blue
  { bg: '#D1FAE5', bar: '#10B981', text: '#065F46' },   // Green
  { bg: '#FEF3C7', bar: '#F59E0B', text: '#92400E' },   // Yellow
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
     * @param {{ silent?: boolean }} opts Hide full-page loading on polling refreshes to prevent flicker.
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
        console.error('Failed to load home data:', err);
      } finally {
        if (!silent) setLoading(false);
      }
    }

    loadData({ silent: false });

    const timer = setInterval(() => loadData({ silent: true }), 30000);
    return () => clearInterval(timer);
  }, []);

  // Generate data for the four lunchbox grids.
  const gridData = [1, 2, 3, 4].map((index) => {
    const detail = latestMeal?.grid_details?.find(g => g.grid_index === index);
    const served = detail?.served_g || 0;
    const intake = detail?.intake_g || 0;
    const foodName = detail?.food_name || `Grid ${index}`;
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
      {/* Row 1: avatar + username */}
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
            {currentUser?.username || 'User'}
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            Welcome back. Enjoy your meal.
          </Typography>
        </Box>
      </Box>

      {/* Row 2: elapsed time + eating speed */}
      <Card
        sx={{
          mb: 4,
          background: 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)',
          color: 'white',
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
                    Time with your lunchbox
                  </Typography>
                  <Typography variant="h4" sx={{ fontWeight: 800 }}>
                    {loading ? '---' : stats.totalTime || 'No records yet'}
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
                    Your eating speed
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

      {/* Four meal-progress cards */}
      <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Restaurant sx={{ color: 'primary.main' }} />
        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B' }}>
          Lunchbox Meal Progress
        </Typography>
        {devices.length > 0 && (
          <Chip
            size="small"
            label={`${devices.length} devices connected`}
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

                {/* Progress bar */}
                <Box sx={{ mb: 2 }}>
                  <LinearProgress
                    variant="determinate"
                    value={grid.progress}
                    sx={{
                      height: 12,
                      borderRadius: '4px',
                      bgcolor: 'rgba(255,255,255,0.5)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: '4px',
                        bgcolor: grid.color.bar,
                        transition: 'transform 0.5s ease',
                      },
                    }}
                  />
                </Box>

                {/* Data details */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="caption" sx={{ color: grid.color.text, opacity: 0.8 }}>
                    Eaten: {grid.intake}g
                  </Typography>
                  <Typography variant="caption" sx={{ color: grid.color.text, opacity: 0.8 }}>
                    Total: {grid.served}g
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty state */}
      {!loading && !latestMeal && (
        <Card
          sx={{
            mt: 3,
            p: 4,
            textAlign: 'center',
            bgcolor: '#F8FAFC',
            border: '1px dashed #CBD5E1',
          }}
        >
          <Typography variant="body1" sx={{ color: '#64748B', mb: 1 }}>
            No meal records yet
          </Typography>
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            Start your first meal and data will sync here automatically.
          </Typography>
        </Card>
      )}
    </Box>
  );
}

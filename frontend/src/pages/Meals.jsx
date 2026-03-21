import { useState, useEffect } from 'react';
import {
  Card, CardContent, Typography, Button, Alert, CircularProgress, Box, Chip, Grid,
  Avatar, Divider, IconButton, Tooltip
} from '@mui/material';
import { 
  Refresh as RefreshIcon, 
  Restaurant as MealIcon,
  Timer as TimerIcon,
  LocalFireDepartment as CalorieIcon,
  AccessTime as TimeIcon
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals } from '../api/meals';

export default function Meals() {
  const currentUser = getCurrentUser();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (cursor = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMeals({ cursor, limit: 20 });
      const list = res.items || [];
      const next = res.next_cursor || '';
      if (cursor) {
        setItems(prev => [...prev, ...list]);
      } else {
        setItems(list);
      }
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
      if (!cursor) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const formatDate = (isoString) => {
    if (!isoString) return '未知时间';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>就餐记录</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>回顾您的每一次健康饮食</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {currentUser && (
            <Chip 
              label={currentUser.username} 
              color="primary" 
              variant="outlined" 
              sx={{ fontWeight: 600, bgcolor: 'rgba(0,191,165,0.08)', border: 'none' }} 
            />
          )}
          <Tooltip title="刷新记录">
            <IconButton onClick={() => load()} disabled={loading} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon sx={{ color: '#64748B' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      {loading && !items.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#00BFA5' }} />
        </Box>
      ) : items.length > 0 ? (
        <Grid container spacing={3}>
          {items.map((m) => (
            <Grid item xs={12} key={m.meal_id}>
              <Card sx={{ 
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
              }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                    <Avatar sx={{ 
                      width: 56, height: 56, 
                      bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10B981',
                      display: { xs: 'none', sm: 'flex' }
                    }}>
                      <MealIcon fontSize="medium" />
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDate(m.start_time)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                          ID: {m.meal_id}
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ my: 1.5 }} />
                      
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<TimeIcon fontSize="small" />}
                          label={new Date(m.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          variant="outlined"
                          sx={{ borderColor: '#E2E8F0', color: '#64748B' }}
                        />
                        {m.duration_minutes != null && (
                          <Chip
                            icon={<TimerIcon fontSize="small" />}
                            label={`${m.duration_minutes} 分钟`}
                            variant="outlined"
                            sx={{ borderColor: '#E2E8F0', color: '#64748B' }}
                          />
                        )}
                        {m.total_meal_cal != null && m.total_meal_cal > 0 && (
                          <Chip
                            icon={<CalorieIcon fontSize="small" />}
                            label={`${m.total_meal_cal} kcal`}
                            sx={{ 
                              bgcolor: 'rgba(239, 68, 68, 0.1)', 
                              color: '#EF4444',
                              fontWeight: 600,
                              border: 'none'
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {nextCursor && (
            <Grid item xs={12} sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => load(nextCursor)}
                disabled={loading}
                sx={{ borderRadius: 8, px: 4 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '加载更多记录'}
              </Button>
            </Grid>
          )}
        </Grid>
      ) : (
        <Card sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)', border: '1px dashed #CBD5E1', boxShadow: 'none' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
              <MealIcon fontSize="large" />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#475569', mb: 1 }}>暂无就餐记录</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', maxWidth: 400, mx: 'auto' }}>
              请先绑定设备并触发遥测数据，或者导入测试数据以查看您的健康饮食记录。
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
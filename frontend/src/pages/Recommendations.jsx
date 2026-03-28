import { useState, useEffect } from 'react';
import { 
  Alert, Box, Button, Card, CardContent, Typography, CircularProgress, 
  Avatar, Chip, Divider, Grid
} from '@mui/material';
import { 
  Lightbulb as BulbIcon,
  RestaurantMenu as MenuIcon,
  EmojiNature as HealthIcon,
  AutoAwesome as SparkleIcon
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchAiAdvice } from '../api/recommendations';

export default function Recommendations() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      // 默认展示 next_meal（明天/未来 3 天的 4 格菜谱推荐）
      const res = await fetchAiAdvice({ type: 'next_meal' });
      setAdvice(res || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <Box sx={{ pb: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>个性化建议</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>专属您的健康饮食指南</Typography>
        </Box>
        <Button 
          variant="contained" 
          onClick={load} 
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SparkleIcon />}
          sx={{ 
            borderRadius: 8, px: 3, py: 1.5,
            background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
            '&:hover': { background: 'linear-gradient(135deg, #059669 0%, #047857 100%)' }
          }}
        >
          {loading ? '生成中...' : '重新生成建议'}
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      {!loading && !advice && !error && (
        <Card sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)', border: '1px dashed #CBD5E1', boxShadow: 'none' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: '#FEF3C7', color: '#F59E0B' }}>
              <BulbIcon fontSize="large" />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#475569', mb: 1 }}>暂无建议</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>点击上方按钮获取最新的个性化饮食建议</Typography>
          </CardContent>
        </Card>
      )}

      {loading && !advice && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10 }}>
          <CircularProgress size={48} sx={{ color: '#F59E0B', mb: 2 }} />
          <Typography sx={{ color: '#64748B', fontWeight: 500 }}>AI 正在为您定制健康菜谱...</Typography>
        </Box>
      )}

      {advice && (
        <Grid container spacing={3}>
          <Grid item xs={12}>
            <Card sx={{ 
              borderRadius: 4,
              overflow: 'hidden',
              boxShadow: '0 12px 32px rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)'
            }}>
              <Box sx={{ 
                background: 'linear-gradient(135deg, rgba(254, 243, 199, 0.5) 0%, rgba(253, 230, 138, 0.5) 100%)',
                p: 3, borderBottom: '1px solid rgba(245, 158, 11, 0.1)',
                display: 'flex', alignItems: 'center', gap: 2
              }}>
                <Avatar sx={{ bgcolor: '#F59E0B', color: 'white', width: 48, height: 48 }}>
                  <MenuIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#92400E' }}>
                    下一餐推荐菜谱
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#B45309' }}>
                    基于您的身体状况和历史数据生成
                  </Typography>
                </Box>
                <Chip 
                  label="AI 定制" 
                  size="small"
                  sx={{ ml: 'auto', bgcolor: '#FEF3C7', color: '#D97706', fontWeight: 700 }} 
                />
              </Box>
              <CardContent sx={{ p: 4, bgcolor: '#FFFFFF' }}>
                <Box sx={{ 
                  typography: 'body1', 
                  lineHeight: 2, 
                  color: '#334155',
                  whiteSpace: 'pre-wrap',
                  fontSize: '1.05rem',
                  '& strong': { color: '#1E293B', fontWeight: 700 }
                }}>
                  {advice.advice}
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          {/* 健康小贴士占位卡片 */}
          <Grid item xs={12} sm={6}>
            <Card sx={{ bgcolor: 'rgba(236, 253, 245, 0.5)', border: '1px solid rgba(16, 185, 129, 0.2)', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <HealthIcon sx={{ color: '#10B981' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#065F46' }}>健康小贴士</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#047857', lineHeight: 1.6 }}>
                  细嚼慢咽有助于消化，建议每餐进食时间保持在 20-30 分钟。您的智能餐盒会自动记录您的用餐速度。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} sm={6}>
            <Card sx={{ bgcolor: 'rgba(239, 246, 255, 0.5)', border: '1px solid rgba(59, 130, 246, 0.2)', boxShadow: 'none' }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <BulbIcon sx={{ color: '#3B82F6' }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, color: '#1E40AF' }}>营养均衡</Typography>
                </Box>
                <Typography variant="body2" sx={{ color: '#1D4ED8', lineHeight: 1.6 }}>
                  合理的碳水、蛋白质和脂肪比例是健康的关键。AI 营养师会根据您每天的摄入情况动态调整明日菜谱。
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
}
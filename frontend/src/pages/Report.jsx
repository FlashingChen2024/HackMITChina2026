import { useState } from 'react';
import { 
  Alert, Box, Button, Card, CardContent, MenuItem, TextField, Typography, 
  CircularProgress, Avatar, Chip, Divider
} from '@mui/material';
import { 
  AutoAwesome as AiIcon,
  LocalDining as DiningIcon,
  WarningAmber as AlertIcon,
  NavigateNext as NextIcon
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchAiAdvice } from '../api/report';

export default function Report() {
  const currentUser = getCurrentUser();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('meal_review');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advice, setAdvice] = useState(null);

  const handleFetch = async () => {
    setLoading(true);
    setError(null);
    setAdvice(null);
    try {
      const res = await fetchAiAdvice({ type: reportType });
      setAdvice(res || null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getReportTypeIcon = (type) => {
    switch(type) {
      case 'meal_review': return <DiningIcon />;
      case 'daily_alert': return <AlertIcon />;
      case 'next_meal': return <NextIcon />;
      default: return <AiIcon />;
    }
  };

  const getReportTypeLabel = (type) => {
    switch(type) {
      case 'meal_review': return '餐次点评';
      case 'daily_alert': return '每日预警';
      case 'next_meal': return '下一餐建议';
      default: return type;
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Avatar sx={{ 
          width: 64, height: 64, mx: 'auto', mb: 2, 
          bgcolor: 'rgba(139, 92, 246, 0.1)', color: '#8B5CF6' 
        }}>
          <AiIcon fontSize="large" />
        </Avatar>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>AI 智能营养师</Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>基于您的历史就餐数据，为您提供个性化健康建议</Typography>
      </Box>

      <Card sx={{ mb: 4 }}>
        <CardContent sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField 
              label="日期" 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)} 
              InputLabelProps={{ shrink: true }} 
              sx={{ flex: 1, minWidth: 150 }}
            />
            <TextField
              select
              label="分析类型"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              sx={{ flex: 2, minWidth: 200 }}
            >
              <MenuItem value="meal_review">餐次点评</MenuItem>
              <MenuItem value="daily_alert">每日预警</MenuItem>
              <MenuItem value="next_meal">下一餐建议</MenuItem>
            </TextField>
            <Button 
              variant="contained" 
              onClick={handleFetch} 
              disabled={loading}
              sx={{ 
                height: 56, px: 4, 
                background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)',
                '&:hover': { background: 'linear-gradient(135deg, #7C3AED 0%, #5B21B6 100%)' }
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : '生成报告'}
            </Button>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 3, borderRadius: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      {advice && (
        <Card sx={{ 
          border: '2px solid transparent',
          background: 'linear-gradient(white, white) padding-box, linear-gradient(135deg, #8B5CF6 0%, #3B82F6 100%) border-box',
        }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: advice.is_alert ? '#FEF3C7' : '#F5F3FF', color: advice.is_alert ? '#F59E0B' : '#8B5CF6' }}>
                  {getReportTypeIcon(advice.type)}
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {getReportTypeLabel(advice.type)}
                </Typography>
              </Box>
              <Chip 
                label={advice.is_alert ? '健康预警' : '健康建议'} 
                color={advice.is_alert ? 'warning' : 'primary'}
                variant={advice.is_alert ? 'filled' : 'outlined'}
                sx={{ 
                  fontWeight: 600,
                  bgcolor: advice.is_alert ? '#F59E0B !important' : undefined,
                  color: advice.is_alert ? '#fff !important' : undefined
                }}
              />
            </Box>
            <Divider sx={{ mb: 3 }} />
            <Box sx={{ 
              typography: 'body1', 
              lineHeight: 1.8, 
              color: '#334155',
              whiteSpace: 'pre-wrap',
              fontSize: '1.1rem'
            }}>
              {advice.advice}
            </Box>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
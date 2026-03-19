import { useState } from 'react';
import { Alert, Box, Button, Card, CardContent, MenuItem, Stack, TextField, Typography } from '@mui/material';
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

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>AI 报告</Typography>
          {currentUser && (
            <Alert severity="info" sx={{ mb: 2 }}>
              当前用户：{currentUser.username}（ID: {currentUser.userId}）
            </Alert>
          )}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField label="日期" type="date" size="small" value={date} onChange={e => setDate(e.target.value)} InputLabelProps={{ shrink: true }} />
            <TextField
              select
              label="类型"
              size="small"
              value={reportType}
              onChange={e => setReportType(e.target.value)}
              sx={{ minWidth: 260 }}
            >
              <MenuItem value="meal_review">餐次点评（meal_review）</MenuItem>
              <MenuItem value="daily_alert">每日预警（daily_alert）</MenuItem>
              <MenuItem value="next_meal">下一餐建议（next_meal）</MenuItem>
            </TextField>
            <Button variant="contained" onClick={handleFetch} disabled={loading}>
              {loading ? '获取中...' : '获取 AI'}
            </Button>
          </Box>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>

      {advice && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>AI 建议内容</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              类型：{advice.type}（{advice.is_alert ? '提醒' : '建议'}）
            </Typography>
            <Box sx={{ whiteSpace: 'pre-wrap', background: '#f8f9fa', p: 2, borderRadius: 1 }}>
              {advice.advice}
            </Box>
          </CardContent>
        </Card>
      )}
    </Stack>
  );
}

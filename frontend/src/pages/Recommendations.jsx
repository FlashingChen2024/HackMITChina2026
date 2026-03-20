import { useState } from 'react';
import { Alert, Button, Card, CardContent, Stack, Typography, Box } from '@mui/material';
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
      // v4.2：个性化建议页面默认展示 next_meal（明天/未来 3 天的 4 格菜谱推荐）
      const res = await fetchAiAdvice({ type: 'next_meal' });
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
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>个性化建议</Typography>
          {currentUser && (
            <Alert severity="info" sx={{ mb: 2 }}>
              当前用户：{currentUser.username}（ID: {currentUser.userId}）
            </Alert>
          )}
          <Button type="button" variant="contained" onClick={load} disabled={loading}>
            {loading ? '加载中...' : '加载建议'}
          </Button>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </CardContent>
      </Card>
      {advice && (
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 1 }}>AI 建议</Typography>
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

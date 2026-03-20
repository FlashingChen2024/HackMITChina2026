import { useState, useEffect } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Box,
  Chip,
} from '@mui/material';
import { Refresh as RefreshIcon, MoreVert as MoreIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals } from '../api/meals';

export default function Meals() {
  const currentUser = getCurrentUser();
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = async (cursor) => {
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

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                🍽️ 用餐记录
              </Typography>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={() => load()}
                disabled={loading}
              >
                刷新
              </Button>
            </Box>
            {currentUser && (
              <Alert severity="info">
                当前用户：<strong>{currentUser.username}</strong>（ID: {currentUser.userId}）
              </Alert>
            )}
            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </CardContent>
        </Card>

        {loading && !items.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : items.length > 0 ? (
          <Card>
            <List>
              {items.map((m, idx) => (
                <ListItem
                  key={m.meal_id}
                  divider={idx < items.length - 1}
                  sx={{
                    '&:hover': { backgroundColor: '#f5f5f5' },
                  }}
                >
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {m.meal_id}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                        <Chip
                          size="small"
                          icon={<MoreIcon />}
                          label={`开始：${m.start_time}`}
                          variant="outlined"
                        />
                        {m.duration_minutes != null && (
                          <Chip
                            size="small"
                            label={`耗时：${m.duration_minutes} 分钟`}
                            variant="outlined"
                          />
                        )}
                        {m.total_meal_cal != null && m.total_meal_cal > 0 && (
                          <Chip
                            size="small"
                            label={`热量：${m.total_meal_cal} kcal`}
                            color="error"
                            variant="outlined"
                          />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>
            {nextCursor && (
              <Box sx={{ p: 2, textAlign: 'center' }}>
                <Button
                  variant="contained"
                  onClick={() => load(nextCursor)}
                  disabled={loading}
                >
                  加载更多
                </Button>
              </Box>
            )}
          </Card>
        ) : (
          <Card>
            <CardContent sx={{ textAlign: 'center', py: 6 }}>
              <Alert severity="warning">
                暂无用餐记录。请先绑定设备并触发遥测（如运行 <code>bash scripts/test_telemetry_flow.sh</code>），
                或通过「导入 Mock 数据」为当前用户写入记录后再做每日汇总。
              </Alert>
            </CardContent>
          </Card>
        )}
      </Box>
    </Container>
  );
}

import { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  Button,
  Alert,
  Box,
  Typography,
  List,
  ListItem,
  ListItemText,
  Chip,
  CircularProgress,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchRecommendations } from '../api/recommendations';

export default function Recommendations() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [list, setList] = useState([]);

  const load = async () => {
    setLoading(true);
    setError(null);
    setList([]);
    try {
      const res = await fetchRecommendations();
      setList(res.data || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority) => {
    if (priority === 'high') return 'error';
    if (priority === 'medium') return 'warning';
    return 'default';
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                💡 个性化建议
              </Typography>
              <Button
                variant="contained"
                startIcon={<RefreshIcon />}
                onClick={load}
                disabled={loading}
              >
                加载建议
              </Button>
            </Box>

            {currentUser && (
              <Alert severity="info" sx={{ mt: 2 }}>
                当前用户：<strong>{currentUser.username}</strong>（ID: {currentUser.userId}）
              </Alert>
            )}

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </CardContent>
        </Card>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : list.length > 0 ? (
          <Card>
            <List>
              {list.map((item, i) => (
                <ListItem
                  key={i}
                  divider={i < list.length - 1}
                  sx={{
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    '&:hover': { backgroundColor: '#f5f5f5' },
                  }}
                >
                  <Box sx={{ display: 'flex', gap: 1, mb: 1, width: '100%', alignItems: 'center' }}>
                    <Chip
                      label={item.priority || 'normal'}
                      size="small"
                      color={getPriorityColor(item.priority)}
                      variant="outlined"
                    />
                    <Typography variant="body1" sx={{ flexGrow: 1 }}>
                      {item.message}
                    </Typography>
                  </Box>

                  {item.suggestions?.length > 0 && (
                    <Box sx={{ ml: 2, mt: 1, width: '100%' }}>
                      <Typography variant="caption" color="textSecondary" sx={{ display: 'block', mb: 1 }}>
                        📌 建议：
                      </Typography>
                      <List dense sx={{ pl: 2 }}>
                        {item.suggestions.map((s, j) => (
                          <ListItem key={j} sx={{ py: 0.5 }}>
                            <ListItemText
                              primary={
                                <Typography variant="body2">{s}</Typography>
                              }
                            />
                          </ListItem>
                        ))}
                      </List>
                    </Box>
                  )}
                </ListItem>
              ))}
            </List>
          </Card>
        ) : null}
      </Box>
    </Container>
  );
}

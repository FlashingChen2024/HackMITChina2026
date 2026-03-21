import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Box,
  Divider
} from '@mui/material';
import { 
  Refresh as RefreshIcon, 
  Timer as TimerIcon,
  LocalFireDepartment as FireIcon,
  Restaurant as RestaurantIcon
} from '@mui/icons-material';
import { fetchMeals } from '../api/meals';

export default function Meals() {
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
    <Box sx={{ px: 3, pb: 4, pt: 2 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '2px solid #000', pb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 900, color: '#000', textTransform: 'uppercase', lineHeight: 1 }}>
          MEALS
        </Typography>
        <Button
          size="small"
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={() => load()}
          disabled={loading}
          sx={{ py: 0.5, px: 2, borderRadius: 0, border: '2px solid #000', boxShadow: 'none', '&:hover': { boxShadow: '2px 2px 0px #000', transform: 'translate(-2px, -2px)' } }}
        >
          SYNC
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 0, border: '2px solid #000' }}>{error}</Alert>}

      {loading && !items.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress size={40} thickness={4} sx={{ color: '#000' }} />
        </Box>
      ) : items.length > 0 ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {items.map((m) => (
            <Card 
              key={m.meal_id}
              sx={{ 
                borderRadius: 0,
                border: '2px solid #000',
                boxShadow: '4px 4px 0px #000',
                bgcolor: '#fff'
              }}
            >
              <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                  <Typography variant="caption" sx={{ fontWeight: 800, color: '#000', bgcolor: '#f4f4f5', px: 1, py: 0.5, border: '1px solid #000' }}>
                    ID: {m.meal_id.substring(0, 8)}...
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    {m.start_time ? m.start_time.split('T')[1]?.substring(0,5) || m.start_time : '??:??'}
                  </Typography>
                </Box>
                
                <Divider sx={{ borderColor: '#000', borderBottomWidth: 2, mb: 2 }} />

                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  {m.duration_minutes != null && (
                    <Box>
                      <Typography variant="caption" sx={{ color: '#52525b', fontWeight: 700, textTransform: 'uppercase' }}>
                        DURATION
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <TimerIcon fontSize="small" sx={{ color: '#000' }} />
                        <Typography variant="body1" sx={{ fontWeight: 800 }}>
                          {m.duration_minutes} MIN
                        </Typography>
                      </Box>
                    </Box>
                  )}
                  
                  {m.total_meal_cal != null && m.total_meal_cal > 0 && (
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="caption" sx={{ color: '#52525b', fontWeight: 700, textTransform: 'uppercase' }}>
                        CALORIES
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: 'flex-end' }}>
                        <FireIcon fontSize="small" sx={{ color: '#000' }} />
                        <Typography variant="body1" sx={{ fontWeight: 900 }}>
                          {m.total_meal_cal} KCAL
                        </Typography>
                      </Box>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          ))}
          
          {nextCursor && (
            <Button
              fullWidth
              variant="outlined"
              onClick={() => load(nextCursor)}
              disabled={loading}
              sx={{ mt: 1, py: 1.5, border: '2px solid #000', boxShadow: 'none' }}
            >
              {loading ? 'LOADING...' : 'LOAD MORE'}
            </Button>
          )}
        </Box>
      ) : (
        <Box sx={{ textAlign: 'center', py: 8, px: 2, border: '2px dashed #000' }}>
          <RestaurantIcon sx={{ fontSize: 64, color: '#000', mb: 2 }} />
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 900, textTransform: 'uppercase' }}>
            NO RECORDS FOUND
          </Typography>
          <Typography variant="body2" sx={{ color: '#52525b', fontWeight: 600 }}>
            Sync your smart box to see your meals here.
          </Typography>
        </Box>
      )}
    </Box>
  );
}
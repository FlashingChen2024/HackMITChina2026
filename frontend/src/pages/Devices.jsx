import { useState, useEffect } from 'react';
import {
  Card, CardContent, TextField, Button, Alert, Box, Typography,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  Grid, Avatar, IconButton, Tooltip, CircularProgress
} from '@mui/material';
import { 
  DeleteOutline as DeleteIcon, 
  AddCircleOutline as AddIcon,
  DevicesOther as DeviceIcon,
  Sensors as SensorIcon,
  Refresh as RefreshIcon
} from '@mui/icons-material';
import { listBindings, bind, unbind } from '../api/devices';

export default function Devices() {
  const [device_id, setDevice_id] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [list, setList] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState('');

  const loadList = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await listBindings();
      // Support two possible payload structures.
      const items = res.devices || res.items || [];
      const normalizedList = items.map(item => 
        typeof item === 'string' ? { device_id: item } : item
      );
      setList(normalizedList);
    } catch (e) {
      setError(e.message);
      setList([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadList();
  }, []);

  const handleBind = async (e) => {
    e.preventDefault();
    if (!device_id.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await bind(device_id.trim());
      setDevice_id('');
      loadList();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    }
  };

  const handleUnbindClick = (did) => {
    setDeleteItemId(did);
    setDeleteDialogOpen(true);
  };

  const handleUnbindConfirm = async () => {
    setLoading(true);
    setError(null);
    try {
      await unbind(deleteItemId);
      loadList();
    } catch (e) {
      setError(e.message);
      setLoading(false);
    } finally {
      setDeleteDialogOpen(false);
      setDeleteItemId('');
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>Device Management</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>Bind and manage your smart lunchbox hardware.</Typography>
        </Box>
        <Tooltip title="Refresh list">
          <IconButton onClick={loadList} disabled={loading} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
            <RefreshIcon sx={{ color: '#64748B' }} />
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      <Card sx={{ mb: 5, overflow: 'visible' }}>
        <Box sx={{ 
          p: 3, 
          background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
          color: 'white',
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          display: 'flex', alignItems: 'center', gap: 2
        }}>
          <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
            <AddIcon />
          </Avatar>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Add New Device</Typography>
        </Box>
        <CardContent sx={{ p: { xs: 3, md: 4 } }}>
          <Box component="form" onSubmit={handleBind} sx={{ display: 'flex', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <TextField
              fullWidth
              placeholder="Enter device ID (e.g. ESP32_A1B2C3)"
              value={device_id}
              onChange={(e) => setDevice_id(e.target.value)}
              variant="outlined"
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: <DeviceIcon sx={{ color: '#94A3B8', mr: 1 }} />
              }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading || !device_id.trim()}
              sx={{
                minWidth: 140, height: 56,
                background: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
                color: '#fff',
                '&:hover': { background: 'linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)' }
              }}
            >
              {loading ? <CircularProgress size={24} sx={{ color: '#fff' }} /> : 'Bind Device'}
            </Button>
          </Box>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#1E293B' }}>
        Connected Devices {list.length > 0 && `(${list.length})`}
      </Typography>

      {loading && !list.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#6366F1' }} />
        </Box>
      ) : list.length > 0 ? (
        <Grid container spacing={3}>
          {list.map((item, idx) => (
            <Grid item xs={12} sm={6} md={4} key={idx}>
              <Card sx={{ 
                height: '100%',
                position: 'relative',
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 12px 24px rgba(99, 102, 241, 0.12)' }
              }}>
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', mb: 3 }}>
                    <Avatar sx={{ width: 56, height: 56, bgcolor: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                      <SensorIcon fontSize="medium" />
                    </Avatar>
                  </Box>
                  <Typography variant="caption" sx={{ color: '#64748B', fontWeight: 600, letterSpacing: 1 }}>
                    DEVICE ID
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B', mb: 2, fontFamily: 'monospace' }}>
                    {item.device_id}
                  </Typography>
                  
                  <Button
                    fullWidth
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={() => handleUnbindClick(item.device_id)}
                    sx={{ borderRadius: 2, mt: 'auto' }}
                  >
                    Unbind
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Card sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)', border: '1px dashed #CBD5E1', boxShadow: 'none' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
              <DeviceIcon fontSize="large" />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#475569', mb: 1 }}>No connected devices</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8' }}>Enter a device ID above to add your smart lunchbox.</Typography>
          </CardContent>
        </Card>
      )}

      {/* Unbind confirmation dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => !loading && setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 4, p: 1 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Confirm unbind?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: '#64748B' }}>
            Are you sure you want to unbind device <strong style={{ color: '#1E293B' }}>{deleteItemId}</strong>? You will no longer receive its real-time data.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} disabled={loading} sx={{ color: '#64748B' }}>
            Cancel
          </Button>
          <Button 
            onClick={handleUnbindConfirm} 
            color="error" 
            variant="contained" 
            disabled={loading}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {loading ? <CircularProgress size={20} color="inherit" /> : 'Confirm Unbind'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

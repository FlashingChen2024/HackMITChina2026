import { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from '@mui/material';
import { Delete as DeleteIcon, Add as AddIcon } from '@mui/icons-material';
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
    setList([]);
    try {
      const res = await listBindings();
      // v4.2：GET /devices 返回 { items: [...] }
      setList(res.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

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
    } finally {
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
    } finally {
      setLoading(false);
      setDeleteDialogOpen(false);
      setDeleteItemId('');
    }
  };

  return (
    <Container maxWidth="md">
      <Box sx={{ py: 2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
              🔌 设备管理
            </Typography>

            <Box component="form" onSubmit={handleBind} sx={{ mb: 3 }}>
              <TextField
                fullWidth
                placeholder="设备 ID 如 aa:bb:cc"
                value={device_id}
                onChange={(e) => setDevice_id(e.target.value)}
                sx={{ mb: 2 }}
              />
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleBind}
                disabled={loading || !device_id.trim()}
              >
                绑定设备
              </Button>
            </Box>

            <Button
              variant="outlined"
              fullWidth
              onClick={loadList}
              disabled={loading}
              sx={{ mb: 2 }}
            >
              查询已绑定设备
            </Button>

            {error && <Alert severity="error">{error}</Alert>}
          </CardContent>
        </Card>

        {list.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                已绑定的设备（{list.length}）
              </Typography>
              <List>
                {list.map((item, idx) => (
                  <ListItem
                    key={idx}
                    divider={idx < list.length - 1}
                    sx={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                            {item.device_id}
                          </Typography>
                        </Box>
                      }
                    />
                    <IconButton
                      edge="end"
                      color="error"
                      onClick={() => handleUnbindClick(item.device_id)}
                      disabled={loading}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </ListItem>
                ))}
              </List>
            </CardContent>
          </Card>
        )}

        <Dialog
          open={deleteDialogOpen}
          onClose={() => setDeleteDialogOpen(false)}
        >
          <DialogTitle>确认解绑</DialogTitle>
          <DialogContent>
            <DialogContentText>
              确定要解绑设备 <strong>{deleteItemId}</strong> 吗？
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button
              onClick={handleUnbindConfirm}
              variant="contained"
              color="error"
              disabled={loading}
            >
              解绑
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Container>
  );
}

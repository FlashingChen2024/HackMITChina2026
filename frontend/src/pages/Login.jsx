import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  TextField,
  Button,
  Box,
  Typography,
  Alert,
  CircularProgress,
  IconButton
} from '@mui/material';
import { Restaurant as RestaurantIcon, ArrowBack as ArrowBackIcon } from '@mui/icons-material';
import { setToken } from '../api/client';
import { login, register } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      if (isRegister) {
        await register(username.trim(), password);
      }
      const res = await login(username.trim(), password);
      if (res && res.token) {
        setToken(res.token);
        navigate('/', { replace: true });
        window.location.reload();
      }
    } catch (err) {
      setError(err.message || 'Error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        p: 0, 
        minHeight: '100vh', 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: '#ffffff',
        borderLeft: { xs: 'none', sm: '2px solid #000' },
        borderRight: { xs: 'none', sm: '2px solid #000' },
        position: 'relative'
      }}
    >
      <Box sx={{ p: 2, display: 'flex', alignItems: 'center' }}>
        <IconButton onClick={() => navigate('/')} sx={{ mr: 1, color: '#000' }}>
          <ArrowBackIcon />
        </IconButton>
      </Box>

      <Box sx={{ flexGrow: 1, px: 4, py: 6, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Box sx={{ mb: 6 }}>
          <Box sx={{ 
            width: 64, height: 64, 
            bgcolor: '#000', 
            color: '#fff',
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            mb: 3,
            boxShadow: '4px 4px 0px #e5e7eb'
          }}>
            <RestaurantIcon sx={{ fontSize: 32 }} />
          </Box>
          <Typography variant="h3" sx={{ fontWeight: 900, mb: 1, color: '#000', lineHeight: 1 }}>
            {isRegister ? 'JOIN.' : 'LOGIN.'}
          </Typography>
          <Typography variant="body1" sx={{ color: '#52525b', fontWeight: 600, textTransform: 'uppercase' }}>
            {isRegister ? 'Create an account to start' : 'Welcome back to K-XYZ'}
          </Typography>
        </Box>

        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          <TextField
            fullWidth
            label="USERNAME"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            variant="outlined"
            InputLabelProps={{ shrink: true, sx: { fontWeight: 800, color: '#000', transform: 'translate(14px, -9px) scale(0.75)', bgcolor: '#fff', px: 1 } }}
          />

          <TextField
            fullWidth
            label="PASSWORD"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            variant="outlined"
            InputLabelProps={{ shrink: true, sx: { fontWeight: 800, color: '#000', transform: 'translate(14px, -9px) scale(0.75)', bgcolor: '#fff', px: 1 } }}
          />

          {error && <Alert severity="error" sx={{ borderRadius: 0, border: '2px solid #000' }}>{error}</Alert>}

          <Button
            fullWidth
            type="submit"
            variant="contained"
            disabled={loading}
            sx={{ mt: 2, py: 2, fontSize: '1.1rem' }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : (isRegister ? 'REGISTER & LOGIN' : 'LOGIN')}
          </Button>

          <Button
            fullWidth
            variant="outlined"
            onClick={() => setIsRegister(!isRegister)}
            sx={{ mt: 1, py: 2 }}
          >
            {isRegister ? 'ALREADY HAVE AN ACCOUNT?' : 'CREATE AN ACCOUNT'}
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
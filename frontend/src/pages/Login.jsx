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
  Card,
  InputAdornment,
  IconButton
} from '@mui/material';
import { 
  PersonOutline as PersonIcon, 
  LockOutlined as LockIcon,
  Visibility,
  VisibilityOff 
} from '@mui/icons-material';
import { setToken } from '../api/client';
import { login, register } from '../api/auth';

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setError('请输入用户名和密码');
      return;
    }
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
      setError(err.message || '请求失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#F8FAFC',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      {/* 装饰性背景 */}
      <Box sx={{
        position: 'absolute', top: -100, right: -100, width: 400, height: 400,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,191,165,0.15) 0%, rgba(0,191,165,0) 70%)'
      }} />
      <Box sx={{
        position: 'absolute', bottom: -100, left: -100, width: 500, height: 500,
        borderRadius: '50%', background: 'radial-gradient(circle, rgba(79,70,229,0.1) 0%, rgba(79,70,229,0) 70%)'
      }} />

      <Container maxWidth="xs" sx={{ position: 'relative', zIndex: 1 }}>
        <Card sx={{ p: { xs: 4, md: 5 }, borderRadius: 4, boxShadow: '0 20px 40px rgba(0,0,0,0.08)', border: 'none' }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Box sx={{ 
              width: 56, height: 56, borderRadius: '16px', 
              background: 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 900, fontSize: 28, mx: 'auto', mb: 2,
              boxShadow: '0 8px 16px rgba(0,191,165,0.3)'
            }}>K</Box>
            <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
              欢迎来到 K-XYZ
            </Typography>
            <Typography variant="body2" sx={{ color: '#64748B' }}>
              {isRegister ? '创建您的智能餐盒账号' : '登录以管理您的健康饮食'}
            </Typography>
          </Box>

          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              fullWidth
              placeholder="用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonIcon sx={{ color: '#94A3B8' }} />
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              type={showPassword ? 'text' : 'password'}
              placeholder="密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              variant="outlined"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockIcon sx={{ color: '#94A3B8' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">
                      {showPassword ? <VisibilityOff sx={{ color: '#94A3B8' }} /> : <Visibility sx={{ color: '#94A3B8' }} />}
                    </IconButton>
                  </InputAdornment>
                )
              }}
            />

            {error && <Alert severity="error" sx={{ borderRadius: 2 }}>{error}</Alert>}

            <Button
              fullWidth
              type="submit"
              variant="contained"
              size="large"
              disabled={loading}
              sx={{ py: 1.5, mt: 1, fontSize: '1rem' }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : (isRegister ? '立即注册并登录' : '登录')}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 1 }}>
              <Button
                disableRipple
                type="button"
                variant="text"
                onClick={() => { setIsRegister(!isRegister); setError(null); }}
                sx={{ color: '#64748B', '&:hover': { bgcolor: 'transparent', color: '#00BFA5' } }}
              >
                {isRegister ? '已有账号？点击登录' : '没有账号？点击注册'}
              </Button>
            </Box>
          </Box>
        </Card>
      </Container>
    </Box>
  );
}
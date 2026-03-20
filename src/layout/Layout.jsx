import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AppBar, Box, Button, Container, Toolbar, Typography } from '@mui/material';
import { getToken, setToken } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();
  const token = getToken();
  const links = [
    { to: '/', label: '首页', end: true },
    { to: '/charts', label: '统计图表' },
    { to: '/report', label: 'AI 报告' },
    { to: '/recommendations', label: '个性化建议' },
    { to: '/meals', label: '用餐记录' },
    { to: '/devices', label: '设备管理' },
    { to: '/communities', label: '社区功能' }
  ];

  const handleLogout = () => {
    setToken('');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  return (
    <Box sx={{ minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={1}>
        <Toolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mr: 1 }}>
            K-XYZ 智能餐盒
          </Typography>
          {links.map((link) => (
            <Button
              key={link.to}
              color="inherit"
              component={NavLink}
              to={link.to}
              end={link.end}
              sx={{
                textTransform: 'none',
                '&.active': { backgroundColor: 'rgba(255,255,255,0.16)' }
              }}
            >
              {link.label}
            </Button>
          ))}
          <Box sx={{ ml: 'auto' }}>
            {token ? (
              <Button color="inherit" variant="outlined" onClick={handleLogout}>
                登出
              </Button>
            ) : (
              <Button color="inherit" component={NavLink} to="/login">
                登录
              </Button>
            )}
          </Box>
        </Toolbar>
      </AppBar>
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Outlet />
      </Container>
    </Box>
  );
}

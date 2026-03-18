import { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Home as HomeIcon,
  BarChart as ChartIcon,
  Assessment as ReportIcon,
  Lightbulb as RecommendationIcon,
  Restaurant as MealsIcon,
  Devices as DevicesIcon,
  Group as CommunityIcon,
  Logout as LogoutIcon,
} from '@mui/icons-material';
import { getToken, setToken, getCurrentUser } from '../api/client';

const DRAWER_WIDTH = 240;

const menuItems = [
  { label: '首页', path: '/', icon: HomeIcon },
  { label: '统计图表', path: '/charts', icon: ChartIcon },
  { label: 'AI 报告', path: '/report', icon: ReportIcon },
  { label: '个性化建议', path: '/recommendations', icon: RecommendationIcon },
  { label: '用餐记录', path: '/meals', icon: MealsIcon },
  { label: '设备管理', path: '/devices', icon: DevicesIcon },
  { label: '社区', path: '/community', icon: CommunityIcon },
];

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [anchorEl, setAnchorEl] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const token = getToken();
  const currentUser = getCurrentUser();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleDesktopDrawerToggle = () => {
    setDesktopOpen(!desktopOpen);
  };

  const handleLogout = () => {
    setToken('');
    setAnchorEl(null);
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const drawer = (
    <Box sx={{ overflow: 'auto', pt: 2 }}>
      <List>
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <ListItem
              key={item.path}
              component="button"
              onClick={() => {
                navigate(item.path);
                if (isMobile) {
                  setMobileOpen(false);
                }
              }}
              selected={isActive}
              sx={{
                backgroundColor: isActive ? 'rgba(25, 118, 210, 0.08)' : 'transparent',
                '&:hover': {
                  backgroundColor: 'rgba(25, 118, 210, 0.12)',
                },
                cursor: 'pointer',
                border: 'none',
                width: '100%',
                textAlign: 'left',
                padding: '8px 16px',
              }}
            >
              <ListItemIcon>
                <Icon sx={{ color: isActive ? 'primary.main' : 'inherit' }} />
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                sx={{
                  '& .MuiListItemText-primary': {
                    color: isActive ? 'primary.main' : 'inherit',
                  },
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={isMobile ? handleDrawerToggle : handleDesktopDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>
          <Box sx={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
            <Box sx={{ fontSize: '1.5rem', fontWeight: 'bold' }}>
              🍱 K-XYZ 智能餐盒
            </Box>
          </Box>
          {token && currentUser && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box sx={{ textAlign: 'right', mr: 1, display: { xs: 'none', sm: 'block' } }}>
                <Box sx={{ fontSize: '0.9rem', fontWeight: 500 }}>{currentUser.username}</Box>
                <Box sx={{ fontSize: '0.8rem', opacity: 0.8 }}>ID: {currentUser.userId}</Box>
              </Box>
              <IconButton
                onClick={handleMenuOpen}
                sx={{ color: 'inherit' }}
              >
                <Avatar sx={{ width: 32, height: 32, backgroundColor: 'rgba(255,255,255,0.3)' }}>
                  {currentUser.username.charAt(0).toUpperCase()}
                </Avatar>
              </IconButton>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
              >
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} />
                  登出
                </MenuItem>
              </Menu>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="temporary"
        open={mobileOpen}
        onClose={handleDrawerToggle}
        sx={{
          display: { xs: 'block', md: 'none' },
          '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH },
        }}
      >
        {drawer}
      </Drawer>

      <Drawer
        variant="persistent"
        open={desktopOpen}
        sx={{
          display: { xs: 'none', md: 'block' },
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: DRAWER_WIDTH,
            mt: 8,
            transition: theme.transitions.create('transform', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.leavingScreen,
            }),
            transform: desktopOpen ? 'translateX(0)' : `translateX(-${DRAWER_WIDTH}px)`,
          },
        }}
      >
        {drawer}
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: {
            md: desktopOpen ? `calc(100% - ${DRAWER_WIDTH}px)` : '100%',
          },
          mt: 8,
          transition: theme.transitions.create('width', {
            easing: theme.transitions.easing.sharp,
            duration: theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <Outlet />
      </Box>
    </Box>
  );
}

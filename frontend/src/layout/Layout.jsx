import { useState } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { 
  AppBar, Box, Container, Toolbar, Typography, IconButton, 
  Drawer, List, ListItem, ListItemButton, ListItemIcon, ListItemText,
  BottomNavigation, BottomNavigationAction, useTheme, useMediaQuery,
  Avatar, Menu, MenuItem, Divider, Tooltip, Badge
} from '@mui/material';
import { 
  Home as HomeIcon,
  BarChart as ChartIcon,
  Restaurant as MealIcon,
  DevicesOther as DeviceIcon,
  FitnessCenter as ProfileIcon,
  Group as CommunityIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon,
  Menu as MenuIcon,
  NotificationsActive as AlertIcon
} from '@mui/icons-material';
import { getToken, setToken, getCurrentUser } from '../api/client';

const DRAWER_WIDTH = 280;

/**
 * Main layout component with sidebar navigation and routing outlet
 */
export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const token = getToken();
  const currentUser = getCurrentUser();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);

  const navItems = [
    { to: '/', label: 'Home', icon: <HomeIcon /> },
    { to: '/charts', label: 'Health Charts', icon: <ChartIcon /> },
    { to: '/meals', label: 'Meal Records', icon: <MealIcon /> },
    { to: '/devices', label: 'Devices', icon: <DeviceIcon /> },
    { to: '/alerts', label: 'Alerts', icon: <AlertIcon /> },
    { to: '/communities', label: 'Communities', icon: <CommunityIcon /> },
    { to: '/profile', label: 'Profile', icon: <ProfileIcon /> }
  ];

  const handleLogout = () => {
    setToken('');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);
  const handleMenuOpen = (e) => setAnchorEl(e.currentTarget);
  const handleMenuClose = () => setAnchorEl(null);

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ p: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Box sx={{ 
          width: 40, height: 40, borderRadius: '12px', 
          background: 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 900, fontSize: 20
        }}>K</Box>
        <Typography variant="h6" sx={{ fontWeight: 800, color: '#1E293B', letterSpacing: '-0.5px' }}>
          Smart Lunchbox
        </Typography>
      </Box>
      <List sx={{ px: 2, flex: 1 }}>
        {navItems.map((item) => {
          const isActive = location.pathname === item.to || (item.to !== '/' && location.pathname.startsWith(item.to));
          return (
            <ListItem key={item.to} disablePadding sx={{ mb: 1 }}>
              <ListItemButton
                component={NavLink}
                to={item.to}
                onClick={() => isMobile && setMobileOpen(false)}
                sx={{
                  borderRadius: 3,
                  py: 1.5,
                  backgroundColor: isActive ? 'rgba(0, 191, 165, 0.08)' : 'transparent',
                  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                  '&:hover': {
                    backgroundColor: isActive ? 'rgba(0, 191, 165, 0.12)' : 'rgba(0,0,0,0.04)',
                  }
                }}
              >
                <ListItemIcon sx={{ 
                  color: isActive ? theme.palette.primary.main : theme.palette.text.secondary,
                  minWidth: 40
                }}>
                  {item.icon}
                </ListItemIcon>
                <ListItemText 
                  primary={item.label} 
                  primaryTypographyProps={{ 
                    fontWeight: isActive ? 700 : 500,
                    fontSize: '0.95rem'
                  }} 
                />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ p: 3 }}>
        <Box sx={{ 
          p: 2, borderRadius: 4, 
          background: 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)',
          display: 'flex', alignItems: 'center', gap: 2,
          border: '1px solid #E2E8F0'
        }}>
          <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.secondary.main }}>
            {currentUser?.username?.[0]?.toUpperCase() || 'U'}
          </Avatar>
          <Box sx={{ flex: 1, overflow: 'hidden' }}>
            <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700, color: '#1E293B' }}>
              {currentUser?.username || 'Not Signed In'}
            </Typography>
            <Typography variant="caption" noWrap sx={{ color: '#64748B' }}>
              ID: {currentUser?.userId?.substring(0, 6) || '---'}
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Desktop sidebar */}
      {!isMobile && (
        <Box component="nav" sx={{ width: DRAWER_WIDTH, flexShrink: 0 }}>
          <Drawer
            variant="permanent"
            sx={{
              '& .MuiDrawer-paper': { 
                boxSizing: 'border-box', 
                width: DRAWER_WIDTH,
                borderRight: '1px dashed #E2E8F0',
                bgcolor: 'background.paper'
              },
            }}
            open
          >
            {drawerContent}
          </Drawer>
        </Box>
      )}

      {/* Mobile sidebar */}
      {isMobile && (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: DRAWER_WIDTH, borderRight: 'none' },
          }}
        >
          {drawerContent}
        </Drawer>
      )}

      {/* Main content area */}
      <Box component="main" sx={{ flexGrow: 1, width: { md: `calc(100% - ${DRAWER_WIDTH}px)` }, pb: { xs: 10, md: 4 } }}>
        {/* Top navigation */}
        <AppBar 
          position="sticky" 
          elevation={0}
          sx={{ 
            bgcolor: 'rgba(248, 250, 252, 0.8)', 
            backdropFilter: 'blur(12px)',
            borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
            color: 'text.primary'
          }}
        >
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            {isMobile && (
              <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2 }}>
                <MenuIcon />
              </IconButton>
            )}
            {!isMobile && <Box />} {/* Spacer */}
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Tooltip title="Account Settings">
                <IconButton onClick={handleMenuOpen} size="small" sx={{ p: 0.5, border: '2px solid transparent', '&:hover': { borderColor: theme.palette.primary.main } }}>
                  <Avatar sx={{ width: 36, height: 36, bgcolor: theme.palette.primary.main, fontSize: '1rem', fontWeight: 'bold' }}>
                    {currentUser?.username?.[0]?.toUpperCase() || 'U'}
                  </Avatar>
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={anchorEl}
                open={Boolean(anchorEl)}
                onClose={handleMenuClose}
                transformOrigin={{ horizontal: 'right', vertical: 'top' }}
                anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
                PaperProps={{
                  elevation: 0,
                  sx: {
                    overflow: 'visible',
                    filter: 'drop-shadow(0px 8px 24px rgba(0,0,0,0.1))',
                    mt: 1.5,
                    borderRadius: 3,
                    minWidth: 200,
                  }
                }}
              >
                <Box sx={{ px: 2, py: 1.5 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{currentUser?.username || 'Guest'}</Typography>
                  <Typography variant="body2" color="text.secondary">System Ready</Typography>
                </Box>
                <Divider />
                <MenuItem onClick={handleLogout} sx={{ py: 1.5, color: 'error.main' }}>
                  <ListItemIcon><LogoutIcon fontSize="small" color="error" /></ListItemIcon>
                  Sign Out
                </MenuItem>
              </Menu>
            </Box>
          </Toolbar>
        </AppBar>

        {/* Nested route outlet */}
        <Container maxWidth="xl" sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
          <Outlet />
        </Container>
      </Box>

      {/* Mobile bottom navigation */}
      {isMobile && (
        <Box sx={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 1100 }}>
          <Box sx={{ 
            position: 'absolute', top: -20, left: 0, right: 0, height: 20, 
            background: 'linear-gradient(to top, rgba(248, 250, 252, 1), transparent)',
            pointerEvents: 'none'
          }} />
          <BottomNavigation
            showLabels
            value={location.pathname}
            onChange={(event, newValue) => navigate(newValue)}
            sx={{
              height: 72,
              borderTop: '1px solid #E2E8F0',
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              backdropFilter: 'blur(10px)',
              pb: 'env(safe-area-inset-bottom)',
              overflowX: 'auto',
              overflowY: 'hidden',
              justifyContent: 'flex-start',
              '&::-webkit-scrollbar': {
                display: 'none'
              },
              scrollbarWidth: 'none'
            }}
          >
            {navItems.map((item) => (
              <BottomNavigationAction 
                key={item.to}
                label={item.label} 
                value={item.to} 
                icon={item.icon}
                sx={{
                  flex: '0 0 auto',
                  minWidth: 76,
                  maxWidth: 96,
                  color: location.pathname === item.to ? 'primary.main' : 'text.secondary',
                  '& .MuiBottomNavigationAction-label': {
                    fontSize: '0.68rem',
                    fontWeight: location.pathname === item.to ? 700 : 500,
                    mt: 0.5,
                    whiteSpace: 'nowrap'
                  },
                  '& .MuiSvgIcon-root': {
                    fontSize: '1.35rem'
                  }
                }}
              />
            ))}
          </BottomNavigation>
        </Box>
      )}
    </Box>
  );
}

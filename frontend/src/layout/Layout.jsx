import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { AppBar, Box, Container, Toolbar, Typography, IconButton, Paper, BottomNavigation, BottomNavigationAction } from '@mui/material';
import { 
  Logout as LogoutIcon, 
  Restaurant as RestaurantIcon,
  Home as HomeIcon,
  BarChart as ChartIcon,
  Forum as ForumIcon,
  MenuBook as MenuBookIcon
} from '@mui/icons-material';
import { getToken, setToken } from '../api/client';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = getToken();

  const handleLogout = () => {
    setToken('');
    navigate('/login', { replace: true });
    window.location.reload();
  };

  // Map paths to bottom navigation indices
  const getNavValue = () => {
    const path = location.pathname;
    if (path === '/') return 0;
    if (path.startsWith('/meals')) return 1;
    if (path.startsWith('/charts') || path.startsWith('/report')) return 2;
    if (path.startsWith('/communities')) return 3;
    return 0; // Default
  };

  return (
    <Container 
      maxWidth="sm" 
      sx={{ 
        p: 0, 
        display: 'flex', 
        flexDirection: 'column',
        bgcolor: 'background.default',
        borderLeft: { xs: 'none', sm: '2px solid #000' },
        borderRight: { xs: 'none', sm: '2px solid #000' },
        borderBottom: { xs: 'none', sm: '2px solid #000' },
        borderTop: { xs: 'none', sm: '2px solid #000' },
        boxShadow: { xs: 'none', sm: '8px 8px 0px #000' },
        position: 'relative',
        overflow: 'hidden',
        my: { xs: 0, sm: 4 },
        height: { xs: '100vh', sm: 'calc(100vh - 64px)' }
      }}
    >
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ px: 2, justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RestaurantIcon sx={{ fontSize: 28, color: '#000' }} />
            <Typography variant="h6" sx={{ fontWeight: 900, letterSpacing: '-0.05em', textTransform: 'uppercase' }}>
              K-XYZ
            </Typography>
          </Box>
          {token && (
            <IconButton 
              onClick={handleLogout} 
              sx={{ 
                color: '#000', 
                border: '2px solid #000', 
                borderRadius: 0, 
                p: 0.5,
                transition: 'all 0.1s',
                '&:hover': { bgcolor: '#000', color: '#fff', transform: 'translate(-2px, -2px)', boxShadow: '2px 2px 0px #000' } 
              }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          )}
        </Toolbar>
      </AppBar>

      <Box 
        component="main" 
        className="no-scrollbar"
        sx={{ 
          flexGrow: 1, 
          overflowY: 'auto', 
          pb: 10, // Space for bottom nav
          animation: 'fadeIn 0.2s ease-out' 
        }}
      >
        <style>
          {`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
          `}
        </style>
        <Outlet />
      </Box>

      {token && (
        <Paper 
          sx={{ 
            position: 'absolute', 
            bottom: 0, 
            left: 0, 
            right: 0, 
            zIndex: 10,
            borderRadius: 0
          }} 
          elevation={0}
        >
          <BottomNavigation
            showLabels
            value={getNavValue()}
            onChange={(event, newValue) => {
              switch(newValue) {
                case 0: navigate('/'); break;
                case 1: navigate('/meals'); break;
                case 2: navigate('/charts'); break;
                case 3: navigate('/communities'); break;
                default: break;
              }
            }}
          >
            <BottomNavigationAction label="HOME" icon={<HomeIcon />} />
            <BottomNavigationAction label="MEALS" icon={<MenuBookIcon />} />
            <BottomNavigationAction label="STATS" icon={<ChartIcon />} />
            <BottomNavigationAction label="SOCIAL" icon={<ForumIcon />} />
          </BottomNavigation>
        </Paper>
      )}
    </Container>
  );
}
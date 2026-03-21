import { Box, Card, Typography, CardActionArea } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart as BarChartIcon, 
  Assessment as AssessmentIcon, 
  TipsAndUpdates as TipsIcon, 
  DevicesOther as DevicesIcon, 
  ArrowForward as ArrowForwardIcon
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';

const quickActions = [
  {
    title: 'AI REPORT',
    desc: 'Generate analysis',
    icon: <AssessmentIcon sx={{ fontSize: 32 }} />,
    path: '/report',
  },
  {
    title: 'ADVICE',
    desc: 'Dietary tips',
    icon: <TipsIcon sx={{ fontSize: 32 }} />,
    path: '/recommendations',
  },
  {
    title: 'DEVICES',
    desc: 'Manage hardware',
    icon: <DevicesIcon sx={{ fontSize: 32 }} />,
    path: '/devices',
  },
  {
    title: 'STATS',
    desc: 'Data & charts',
    icon: <BarChartIcon sx={{ fontSize: 32 }} />,
    path: '/charts',
  }
];

export default function Home() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  return (
    <Box sx={{ px: 3, pb: 4 }}>
      {/* Header Greeting */}
      <Box sx={{ mb: 4, mt: 3, borderBottom: '2px solid #000', pb: 2 }}>
        <Typography variant="h3" sx={{ fontWeight: 900, color: '#000', lineHeight: 1 }}>
          HELLO,
        </Typography>
        <Typography variant="h3" sx={{ fontWeight: 900, color: '#000', mb: 1, lineHeight: 1 }}>
          {user ? user.username.toUpperCase() : 'GUEST'}.
        </Typography>
        <Typography variant="subtitle1" color="text.secondary" sx={{ textTransform: 'uppercase' }}>
          TRACK YOUR NUTRITION.
        </Typography>
      </Box>

      {/* Hero Card */}
      <Card 
        sx={{ 
          mb: 4,
          bgcolor: '#000',
          color: '#fff',
          p: 3,
          cursor: 'pointer',
          transition: 'transform 0.1s',
          '&:active': { transform: 'scale(0.98)' }
        }}
        onClick={() => navigate('/meals')}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box>
            <Typography variant="h5" sx={{ mb: 1, color: '#fff' }}>
              TODAY'S LOG
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.8, mb: 3, maxWidth: '80%' }}>
              Sync and view your latest meal records from the smart box.
            </Typography>
          </Box>
          <ArrowForwardIcon fontSize="large" sx={{ color: '#fff' }} />
        </Box>
        <Typography variant="button" sx={{ borderBottom: '2px solid #fff', pb: 0.5 }}>
          VIEW MEALS
        </Typography>
      </Card>

      <Typography variant="h6" sx={{ mb: 2, color: '#000', textTransform: 'uppercase' }}>
        QUICK ACTIONS
      </Typography>
      
      {/* Grid Menu */}
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
        {quickActions.map((item, idx) => (
          <Card 
            key={idx}
            sx={{ 
              bgcolor: '#fff',
              transition: 'all 0.1s',
              '&:hover': {
                bgcolor: '#000',
                color: '#fff',
                '& .MuiTypography-root': { color: '#fff' },
                '& svg': { color: '#fff' }
              }
            }}
          >
            <CardActionArea 
              onClick={() => navigate(item.path)}
              sx={{ p: 2.5, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', height: '100%' }}
            >
              <Box sx={{ mb: 2 }}>
                {item.icon}
              </Box>
              <Typography variant="subtitle1" sx={{ mb: 0.5, color: '#000' }}>
                {item.title}
              </Typography>
              <Typography variant="caption" sx={{ color: '#52525b', fontWeight: 600, textTransform: 'uppercase' }}>
                {item.desc}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
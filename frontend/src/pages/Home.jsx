import { Box, Typography, Grid, Card, CardActionArea, CardContent, useTheme, Avatar } from '@mui/material';
import { 
  BarChart as ChartIcon,
  Assignment as ReportIcon,
  Lightbulb as BulbIcon,
  Restaurant as MealIcon,
  DevicesOther as DeviceIcon,
  Group as CommunityIcon,
  TrendingUp as TrendIcon,
  EmojiEvents as StarIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const modules = [
  { 
    title: '健康图表', 
    desc: '日趋势、周对比、浪费率等全方位数据', 
    path: '/charts', 
    icon: <ChartIcon fontSize="large" />,
    color: '#3B82F6',
    bgColor: '#EFF6FF'
  },
  { 
    title: 'AI 报告', 
    desc: '获取个性化餐次点评与每日预警', 
    path: '/report', 
    icon: <ReportIcon fontSize="large" />,
    color: '#8B5CF6',
    bgColor: '#F5F3FF'
  },
  { 
    title: '个性建议', 
    desc: '基于历史数据的科学饮食建议', 
    path: '/recommendations', 
    icon: <BulbIcon fontSize="large" />,
    color: '#F59E0B',
    bgColor: '#F5F3FF'
  },
  { 
    title: '就餐记录', 
    desc: '查看每一次就餐的高精详情', 
    path: '/meals', 
    icon: <MealIcon fontSize="large" />,
    color: '#10B981',
    bgColor: '#ECFDF5'
  },
  { 
    title: '设备管理', 
    desc: '绑定智能餐盒，开启数据之旅', 
    path: '/devices', 
    icon: <DeviceIcon fontSize="large" />,
    color: '#6366F1',
    bgColor: '#EEF2FF'
  },
  { 
    title: '圈子社区', 
    desc: '加入健康营，和大家一起吃得更好', 
    path: '/communities', 
    icon: <CommunityIcon fontSize="large" />,
    color: '#EC4899',
    bgColor: '#FDF2F8'
  }
];

export default function Home() {
  const navigate = useNavigate();
  const theme = useTheme();

  return (
    <Box sx={{ pb: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B' }}>
          早上好，准备好健康的一天了吗？
        </Typography>
        <Typography variant="subtitle1" sx={{ color: '#64748B' }}>
          追踪饮食情况，获取 AI 分析与建议。
        </Typography>
      </Box>

      {/* 顶部欢迎卡片 */}
      <Card sx={{ 
        mb: 4, 
        background: 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)',
        color: 'white',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 12px 24px rgba(0,191,165,0.2)'
      }}>
        <Box sx={{ 
          position: 'absolute', right: -20, top: -20, 
          opacity: 0.1, transform: 'scale(2)'
        }}>
          <TrendIcon sx={{ fontSize: 120 }} />
        </Box>
        <CardContent sx={{ p: { xs: 3, md: 4 }, position: 'relative', zIndex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: '#fff' }}>
              <StarIcon />
            </Avatar>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              今日目标：均衡饮食
            </Typography>
          </Box>
          <Typography variant="body1" sx={{ opacity: 0.9, maxWidth: 500 }}>
            您的智能餐盒已准备就绪。每次就餐的数据都会自动同步，我们的云端 AI 营养师将为您提供实时指导。
          </Typography>
        </CardContent>
      </Card>

      <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#1E293B' }}>
        功能模块
      </Typography>

      <Grid container spacing={3}>
        {modules.map((item) => (
          <Grid item xs={12} sm={6} md={4} key={item.path}>
            <Card sx={{ 
              height: '100%', 
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 24px rgba(0,0,0,0.06)'
              }
            }}>
              <CardActionArea 
                onClick={() => navigate(item.path)}
                sx={{ height: '100%', p: 3, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}
              >
                <Box sx={{ 
                  p: 1.5, borderRadius: 3, mb: 2,
                  bgcolor: item.bgColor, color: item.color,
                  display: 'inline-flex'
                }}>
                  {item.icon}
                </Box>
                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: '#1E293B' }}>
                  {item.title}
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', lineHeight: 1.6 }}>
                  {item.desc}
                </Typography>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </Box>
  );
}
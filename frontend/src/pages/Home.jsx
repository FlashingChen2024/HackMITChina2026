import { Box, Container, Grid, Card, CardContent, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import {
  BarChart as ChartIcon,
  Assessment as ReportIcon,
  Lightbulb as RecommendationIcon,
  Devices as DevicesIcon,
} from '@mui/icons-material';

const features = [
  {
    icon: ChartIcon,
    title: '统计图表',
    description: '日趋势、周对比、浪费率、用餐速度、营养饼图',
    path: '/charts',
    color: '#FF6B6B',
  },
  {
    icon: ReportIcon,
    title: 'AI 报告',
    description: '生成并查看饮食分析报告',
    path: '/report',
    color: '#4ECDC4',
  },
  {
    icon: RecommendationIcon,
    title: '个性化建议',
    description: '基于最近报告与诊断的建议列表',
    path: '/recommendations',
    color: '#45B7D1',
  },
  {
    icon: DevicesIcon,
    title: '设备管理',
    description: '智能餐盒设备绑定与解绑',
    path: '/devices',
    color: '#FFA07A',
  },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="h3" sx={{ fontWeight: 'bold', mb: 2 }}>
            🍱 K-XYZ 智能餐盒系统
          </Typography>
          <Typography variant="h6" color="textSecondary">
            饮食情况追踪与 AI 分析建议
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Grid item xs={12} sm={6} md={6} lg={3} key={feature.path}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s',
                    cursor: 'pointer',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: 4,
                    },
                  }}
                  onClick={() => navigate(feature.path)}
                >
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                    <Box
                      sx={{
                        mb: 2,
                        display: 'inline-flex',
                        p: 1.5,
                        borderRadius: '12px',
                        backgroundColor: feature.color + '20',
                      }}
                    >
                      <Icon sx={{ fontSize: 40, color: feature.color }} />
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="textSecondary" sx={{ mb: 2 }}>
                      {feature.description}
                    </Typography>
                  </CardContent>
                  <Box sx={{ px: 2, pb: 2 }}>
                    <Button
                      fullWidth
                      variant="contained"
                      sx={{ backgroundColor: feature.color }}
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(feature.path);
                      }}
                    >
                      进入
                    </Button>
                  </Box>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box sx={{ mt: 6, p: 3, backgroundColor: '#f5f5f5', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
            📋 快速开始
          </Typography>
          <Box component="ul" sx={{ listStyle: 'none', p: 0 }}>
            <Box component="li" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 500 }}>✓ 设备管理：</Typography>
              <Typography sx={{ ml: 1, color: 'textSecondary' }}>先绑定你的智能餐盒设备</Typography>
            </Box>
            <Box component="li" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 500 }}>✓ 用餐记录：</Typography>
              <Typography sx={{ ml: 1, color: 'textSecondary' }}>查看和管理你的每日用餐数据</Typography>
            </Box>
            <Box component="li" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 500 }}>✓ 统计图表：</Typography>
              <Typography sx={{ ml: 1, color: 'textSecondary' }}>分析你的饮食趋势和营养摄入</Typography>
            </Box>
            <Box component="li" sx={{ display: 'flex', alignItems: 'center' }}>
              <Typography sx={{ fontWeight: 500 }}>✓ AI 报告：</Typography>
              <Typography sx={{ ml: 1, color: 'textSecondary' }}>获取个性化的健康建议</Typography>
            </Box>
          </Box>
        </Box>
      </Box>
    </Container>
  );
}

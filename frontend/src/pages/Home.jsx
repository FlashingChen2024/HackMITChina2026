import { Card, CardContent, Link, List, ListItem, ListItemText, Typography } from '@mui/material';

export default function Home() {
  return (
    <Card>
      <CardContent>
        <Typography variant="h4" sx={{ mb: 1, fontWeight: 700 }}>首页</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          饮食情况追踪与 AI 分析建议 - 模块5 前端
        </Typography>
        <List>
          <ListItem>
            <ListItemText
              primary={<Link href="/charts" underline="hover">统计图表</Link>}
              secondary="日趋势、周对比、浪费率、用餐速度、营养饼图"
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={<Link href="/report" underline="hover">AI 报告</Link>}
              secondary="生成并查看饮食分析报告"
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={<Link href="/recommendations" underline="hover">个性化建议</Link>}
              secondary="基于最近报告与诊断的建议列表"
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={<Link href="/devices" underline="hover">设备管理</Link>}
              secondary="智能餐盒设备绑定与解绑"
            />
          </ListItem>
          <ListItem>
            <ListItemText
              primary={<Link href="/communities" underline="hover">社区功能</Link>}
              secondary="创建社区、输入社区ID加入、查看和管理我的社区"
            />
          </ListItem>
        </List>
      </CardContent>
    </Card>
  );
}

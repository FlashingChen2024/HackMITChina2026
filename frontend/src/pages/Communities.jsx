import { useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  Paper,
  Tab,
  Tabs,
  TextField,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  Dashboard as DashboardIcon,
  GroupAdd as JoinIcon,
  PeopleAlt as PeopleIcon,
} from '@mui/icons-material';
import { createCommunity, getCommunityDashboard, joinCommunity } from '../api/communities';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function formatGrams(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '-';
  return `${n.toFixed(1)} g`;
}

export default function Communities() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  const [joinId, setJoinId] = useState('');

  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;

    setLoading(true);
    clearMessages();
    try {
      const res = await createCommunity({
        name: createName.trim(),
        description: createDesc.trim(),
      });
      setLastCreatedId(res.community_id || '');
      setSuccess(`成功创建社区：${createName.trim()}`);
      setCreateName('');
      setCreateDesc('');
    } catch (err) {
      setError(err.message || '创建社区失败');
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;

    setLoading(true);
    clearMessages();
    try {
      const cid = joinId.trim().toUpperCase();
      await joinCommunity(cid);
      setSuccess('成功加入社区');
      setDashboardId(cid);
      setJoinId('');
      setTimeout(() => setActiveTab(2), 500);
    } catch (err) {
      setError(err.message || '加入社区失败');
    } finally {
      setLoading(false);
    }
  };

  const onLoadDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardId.trim()) return;

    setLoading(true);
    clearMessages();
    try {
      const res = await getCommunityDashboard(dashboardId.trim().toUpperCase());
      setDashboard(res || null);
    } catch (err) {
      setDashboard(null);
      setError(err.message || '加载社区看板失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
          圈子社区
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>
          创建社区、加入社区并查看社区聚合看板
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

      <Card>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={activeTab}
            onChange={(_, value) => {
              setActiveTab(value);
              clearMessages();
            }}
            variant="fullWidth"
            sx={{ '& .Mui-selected': { color: theme.palette.primary.main } }}
          >
            <Tab icon={<AddIcon />} iconPosition="start" label="创建社区" />
            <Tab icon={<JoinIcon />} iconPosition="start" label="加入社区" />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="社区看板" />
          </Tabs>
        </Box>

        <CardContent>
          <TabPanel value={activeTab} index={0}>
            <Box component="form" onSubmit={onCreate} sx={{ maxWidth: 560, display: 'grid', gap: 2 }}>
              <TextField
                label="社区名称"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                required
              />
              <TextField
                label="社区简介"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                multiline
                minRows={3}
              />
              <Button type="submit" variant="contained" disabled={loading || !createName.trim()}>
                {loading ? <CircularProgress size={20} color="inherit" /> : '创建社区'}
              </Button>
            </Box>

            {lastCreatedId && (
              <Paper sx={{ mt: 3, p: 2, bgcolor: '#F8FAFC', border: '1px dashed #CBD5E1' }}>
                <Typography variant="body2" sx={{ color: '#64748B' }}>新社区 ID</Typography>
                <Typography sx={{ fontFamily: 'monospace', fontWeight: 700 }}>{lastCreatedId}</Typography>
              </Paper>
            )}
          </TabPanel>

          <TabPanel value={activeTab} index={1}>
            <Box component="form" onSubmit={onJoin} sx={{ maxWidth: 560, display: 'grid', gap: 2 }}>
              <TextField
                label="社区 ID"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                placeholder="例如：COMM_12345"
                required
              />
              <Button type="submit" variant="contained" disabled={loading || !joinId.trim()}>
                {loading ? <CircularProgress size={20} color="inherit" /> : '加入社区'}
              </Button>
            </Box>
          </TabPanel>

          <TabPanel value={activeTab} index={2}>
            <Box component="form" onSubmit={onLoadDashboard} sx={{ maxWidth: 680, display: 'flex', gap: 2, mb: 3 }}>
              <TextField
                label="社区 ID"
                value={dashboardId}
                onChange={(e) => setDashboardId(e.target.value)}
                fullWidth
              />
              <Button type="submit" variant="contained" disabled={loading || !dashboardId.trim()}>
                {loading ? <CircularProgress size={20} color="inherit" /> : '加载看板'}
              </Button>
            </Box>

            {dashboard && (
              <Box>
                <Paper sx={{ p: 3, mb: 3, bgcolor: '#0F172A', color: '#fff' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{dashboard.community_name}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.8 }}>ID: {dashboard.community_id}</Typography>
                  <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 2 }}>
                    <PeopleIcon fontSize="small" />
                    <Typography variant="body2">成员数：{dashboard.member_count}</Typography>
                  </Box>
                </Paper>

                <Grid container spacing={2}>
                  {(dashboard.food_avg_stats || []).map((item, idx) => {
                    const leftover = item.avg_leftover_g ?? Math.max(Number(item.avg_served_g || 0) - Number(item.avg_intake_g || 0), 0);
                    return (
                      <Grid item xs={12} md={6} key={`${item.food_name || 'food'}-${idx}`}>
                        <Card sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                          <CardContent>
                            <Typography sx={{ fontWeight: 700, mb: 1 }}>{item.food_name || '未知菜品'}</Typography>
                            <Typography variant="body2">打饭均值：{formatGrams(item.avg_served_g)}</Typography>
                            <Typography variant="body2">摄入均值：{formatGrams(item.avg_intake_g)}</Typography>
                            <Typography variant="body2">剩余均值：{formatGrams(leftover)}</Typography>
                            <Typography variant="body2">平均速度：{Number(item.avg_speed_g_per_min || 0).toFixed(1)} g/min</Typography>
                          </CardContent>
                        </Card>
                      </Grid>
                    );
                  })}
                </Grid>

                {(!dashboard.food_avg_stats || dashboard.food_avg_stats.length === 0) && (
                  <Alert severity="info" sx={{ mt: 2 }}>该社区暂无菜品统计数据</Alert>
                )}
              </Box>
            )}

            {!dashboard && !loading && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
                  <DashboardIcon />
                </Avatar>
                <Typography sx={{ color: '#64748B' }}>输入社区 ID 后可查看社区聚合看板</Typography>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}

import { useState, useEffect } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Grid,
  IconButton,
  Paper,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useTheme,
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  ContentCopy as CopyIcon,
  Dashboard as DashboardIcon,
  GroupAdd as JoinIcon,
  PeopleAlt as PeopleIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { createCommunity, getCommunityDashboard, joinCommunity, listCommunities } from '../api/communities';

function TabPanel({ children, value, index }) {
  return (
    <div role="tabpanel" hidden={value !== index}>
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

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

  // 我的社区列表
  const [myCommunities, setMyCommunities] = useState([]);
  const [loadingMyCommunities, setLoadingMyCommunities] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  const [joinId, setJoinId] = useState('');

  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  // 加载我的社区列表
  const loadMyCommunities = async () => {
    setLoadingMyCommunities(true);
    try {
      const res = await listCommunities();
      setMyCommunities(res.items || []);
    } catch (err) {
      console.error('加载社区列表失败:', err);
    } finally {
      setLoadingMyCommunities(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadMyCommunities();
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // 复制到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('已复制到剪贴板');
    setTimeout(() => setSuccess(''), 2000);
  };

  // 跳转到社区看板
  const goToDashboard = (communityId) => {
    setDashboardId(communityId);
    setActiveTab(3);
    // 自动加载看板
    setTimeout(() => {
      handleLoadDashboardById(communityId);
    }, 100);
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
      // 刷新社区列表
      loadMyCommunities();
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
      // 刷新社区列表
      loadMyCommunities();
      setTimeout(() => setActiveTab(3), 500);
    } catch (err) {
      setError(err.message || '加入社区失败');
    } finally {
      setLoading(false);
    }
  };

  const handleLoadDashboardById = async (cid) => {
    setLoading(true);
    clearMessages();
    try {
      const res = await getCommunityDashboard(cid.toUpperCase());
      setDashboard(res || null);
    } catch (err) {
      setDashboard(null);
      setError(err.message || '加载社区看板失败');
    } finally {
      setLoading(false);
    }
  };

  const onLoadDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardId.trim()) return;
    await handleLoadDashboardById(dashboardId);
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
            <Tab icon={<PeopleIcon />} iconPosition="start" label="我的社区" />
            <Tab icon={<AddIcon />} iconPosition="start" label="创建社区" />
            <Tab icon={<JoinIcon />} iconPosition="start" label="加入社区" />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="社区看板" />
          </Tabs>
        </Box>

        <CardContent>
          {/* 我的社区选项卡 */}
          <TabPanel value={activeTab} index={0}>
            {loadingMyCommunities ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
              </Box>
            ) : myCommunities.length > 0 ? (
              <Grid container spacing={2}>
                {myCommunities.map((community) => (
                  <Grid item xs={12} sm={6} key={community.community_id}>
                    <Card variant="outlined" sx={{ height: '100%' }}>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {community.name}
                          </Typography>
                          <Chip
                            size="small"
                            icon={<PeopleIcon fontSize="small" />}
                            label={community.member_count}
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {community.description || '暂无描述'}
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                          <Typography
                            variant="caption"
                            sx={{
                              fontFamily: 'monospace',
                              bgcolor: 'grey.100',
                              px: 1,
                              py: 0.5,
                              borderRadius: 1,
                              flex: 1,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            ID: {community.community_id}
                          </Typography>
                          <Tooltip title="复制社区ID">
                            <IconButton
                              size="small"
                              onClick={() => copyToClipboard(community.community_id)}
                            >
                              <CopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Box>
                        <Button
                          fullWidth
                          variant="outlined"
                          size="small"
                          startIcon={<ViewIcon />}
                          onClick={() => goToDashboard(community.community_id)}
                        >
                          查看看板
                        </Button>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            ) : (
              <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                <PeopleIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  您还没有加入任何社区
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  创建一个新社区或加入已有社区开始分享
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button variant="contained" onClick={() => setActiveTab(1)}>
                    创建社区
                  </Button>
                  <Button variant="outlined" onClick={() => setActiveTab(2)}>
                    加入社区
                  </Button>
                </Box>
              </Paper>
            )}
          </TabPanel>

          {/* 创建社区选项卡 */}
          <TabPanel value={activeTab} index={1}>
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
              <Paper sx={{ mt: 3, p: 3, bgcolor: '#F0FDF4', border: '1px solid #86EFAC' }}>
                <Typography variant="body2" sx={{ color: '#166534', mb: 1 }}>
                  ✅ 社区创建成功！
                </Typography>
                <Typography variant="body2" sx={{ color: '#64748B', mb: 1 }}>
                  社区 ID（请复制分享给朋友）：
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Typography
                    sx={{
                      fontFamily: 'monospace',
                      fontWeight: 700,
                      fontSize: '1.1rem',
                      bgcolor: 'white',
                      px: 2,
                      py: 1,
                      borderRadius: 1,
                      border: '1px solid #CBD5E1',
                      flex: 1,
                    }}
                  >
                    {lastCreatedId}
                  </Typography>
                  <Button
                    variant="contained"
                    startIcon={<CopyIcon />}
                    onClick={() => copyToClipboard(lastCreatedId)}
                    sx={{ whiteSpace: 'nowrap' }}
                  >
                    复制 ID
                  </Button>
                </Box>
              </Paper>
            )}
          </TabPanel>

          {/* 加入社区选项卡 */}
          <TabPanel value={activeTab} index={2}>
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

          {/* 社区看板选项卡 */}
          <TabPanel value={activeTab} index={3}>
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
                <Paper sx={{ p: 3, mb: 3, bgcolor: '#1a1a2e', color: '#fff' }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>{dashboard.community_name}</Typography>
                  <Typography variant="body2" sx={{ opacity: 0.9 }}>ID: {dashboard.community_id}</Typography>
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

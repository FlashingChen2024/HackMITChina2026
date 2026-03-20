import { useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, TextField, Typography,
  Tabs, Tab, Grid, Avatar, Chip, CircularProgress, Paper, Divider, useTheme
} from '@mui/material';
import {
  AddCircleOutline as AddIcon,
  GroupAdd as JoinIcon,
  Dashboard as DashboardIcon,
  PeopleAlt as PeopleIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';
import { createCommunity, joinCommunity, getCommunityDashboard } from '../api/communities';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div role="tabpanel" hidden={value !== index} {...other}>
      {value === index && <Box sx={{ pt: 4 }}>{children}</Box>}
    </div>
  );
}

export default function Communities() {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 创建社区
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  // 加入社区
  const [joinId, setJoinId] = useState('');

  // 看板
  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
    clearMessages();
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setLoading(true); clearMessages();
    try {
      const res = await createCommunity({ name: createName.trim(), description: createDesc.trim() });
      setLastCreatedId(res.community_id || '');
      setSuccess(`成功创建社区：${createName}`);
      setCreateName('');
      setCreateDesc('');
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  const onJoin = async (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    setLoading(true); clearMessages();
    try {
      await joinCommunity(joinId.trim().toUpperCase());
      setSuccess('成功加入社区！');
      setDashboardId(joinId.trim().toUpperCase());
      setJoinId('');
      // 可选：加入成功后自动跳到看板
      setTimeout(() => setActiveTab(2), 1500);
    } catch (err) {
      setError(err.message || '加入失败，请检查 ID 是否正确');
    } finally {
      setLoading(false);
    }
  };

  const onLoadDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardId.trim()) return;
    setLoading(true); clearMessages();
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
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>圈子社区</Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>加入健康营，和大家一起吃得更好</Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{error}</Alert>}
      {success && <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>{success}</Alert>}

      <Card sx={{ borderRadius: 4, overflow: 'hidden' }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'rgba(248, 250, 252, 0.5)' }}>
          <Tabs 
            value={activeTab} 
            onChange={handleTabChange}
            variant="fullWidth"
            sx={{
              '& .MuiTab-root': { py: 2.5, fontWeight: 600, fontSize: '1rem' },
              '& .Mui-selected': { color: theme.palette.primary.main }
            }}
          >
            <Tab icon={<AddIcon />} iconPosition="start" label="创建社区" />
            <Tab icon={<JoinIcon />} iconPosition="start" label="加入社区" />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="社区看板" />
          </Tabs>
        </Box>

        <CardContent sx={{ p: { xs: 3, md: 5 } }}>
          {/* 创建社区 */}
          <TabPanel value={activeTab} index={0}>
            <Box sx={{ maxWidth: 500, mx: 'auto' }}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                  <AddIcon fontSize="large" />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>发起新的健康圈子</Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>创建后将生成专属 ID，邀请好友加入</Typography>
              </Box>

              <Box component="form" onSubmit={onCreate} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField 
                  label="社区名称" 
                  value={createName} 
                  onChange={(e) => setCreateName(e.target.value)} 
                  fullWidth
                  required
                />
                <TextField 
                  label="社区简介" 
                  value={createDesc} 
                  onChange={(e) => setCreateDesc(e.target.value)} 
                  fullWidth
                  multiline
                  rows={3}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading || !createName.trim()}
                  sx={{ height: 56, fontSize: '1.05rem' }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : '立即创建'}
                </Button>
              </Box>

              {lastCreatedId && (
                <Paper sx={{ mt: 4, p: 3, bgcolor: '#F8FAFC', border: '1px dashed #CBD5E1', textAlign: 'center', borderRadius: 3 }}>
                  <Typography variant="subtitle2" sx={{ color: '#64748B', mb: 1 }}>社区创建成功！您的专属 ID：</Typography>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                    <Typography variant="h5" sx={{ fontWeight: 800, color: '#1E293B', fontFamily: 'monospace', letterSpacing: 2 }}>
                      {lastCreatedId}
                    </Typography>
                    <Button 
                      size="small" 
                      onClick={() => navigator.clipboard.writeText(lastCreatedId)}
                      sx={{ minWidth: 0, p: 1 }}
                    >
                      <CopyIcon fontSize="small" />
                    </Button>
                  </Box>
                </Paper>
              )}
            </Box>
          </TabPanel>

          {/* 加入社区 */}
          <TabPanel value={activeTab} index={1}>
            <Box sx={{ maxWidth: 500, mx: 'auto' }}>
              <Box sx={{ textAlign: 'center', mb: 4 }}>
                <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6' }}>
                  <JoinIcon fontSize="large" />
                </Avatar>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>加入已有圈子</Typography>
                <Typography variant="body2" sx={{ color: '#64748B' }}>输入好友分享的社区 ID</Typography>
              </Box>

              <Box component="form" onSubmit={onJoin} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <TextField 
                  label="社区 ID" 
                  placeholder="例如：C8F3A1B2" 
                  value={joinId} 
                  onChange={(e) => setJoinId(e.target.value)} 
                  fullWidth
                  required
                  InputProps={{ sx: { fontFamily: 'monospace', letterSpacing: 1 } }}
                />
                <Button 
                  type="submit" 
                  variant="contained" 
                  disabled={loading || !joinId.trim()}
                  sx={{ height: 56, fontSize: '1.05rem', background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)' }}
                >
                  {loading ? <CircularProgress size={24} color="inherit" /> : '申请加入'}
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* 社区看板 */}
          <TabPanel value={activeTab} index={2}>
            <Box component="form" onSubmit={onLoadDashboard} sx={{ display: 'flex', gap: 2, mb: 4, maxWidth: 600, mx: 'auto' }}>
              <TextField
                label="输入社区 ID 查看"
                placeholder="例如：C8F3A1B2"
                value={dashboardId}
                onChange={(e) => setDashboardId(e.target.value)}
                fullWidth
                size="small"
                sx={{ '& .MuiOutlinedInput-root': { height: 48 } }}
              />
              <Button 
                type="submit" 
                variant="contained" 
                disabled={loading || !dashboardId.trim()}
                sx={{ minWidth: 120, height: 48, background: 'linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)' }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '查看看板'}
              </Button>
            </Box>

            {!dashboard && !loading && (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Avatar sx={{ width: 80, height: 80, mx: 'auto', mb: 2, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
                  <DashboardIcon sx={{ fontSize: 40 }} />
                </Avatar>
                <Typography sx={{ color: '#64748B' }}>加载社区大屏，查看成员健康饮食排行与统计</Typography>
              </Box>
            )}

            {dashboard && (
              <Box sx={{ animation: 'fadeIn 0.5s ease-in-out' }}>
                <Paper sx={{ 
                  p: 3, mb: 4, 
                  background: 'linear-gradient(135deg, #1E293B 0%, #0F172A 100%)',
                  color: 'white', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2
                }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>{dashboard.community_name}</Typography>
                    <Typography variant="body2" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>ID: {dashboard.community_id}</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, bgcolor: 'rgba(255,255,255,0.1)', px: 2, py: 1, borderRadius: 2 }}>
                    <PeopleIcon />
                    <Typography sx={{ fontWeight: 700, fontSize: '1.2rem' }}>{dashboard.member_count} <span style={{ fontSize: '0.9rem', fontWeight: 400, opacity: 0.8 }}>名成员</span></Typography>
                  </Box>
                </Paper>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 2, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 1 }}>
                  <span style={{ width: 4, height: 20, backgroundColor: '#00BFA5', borderRadius: 2 }}></span>
                  菜品均值统计
                </Typography>

                <Grid container spacing={2}>
                  {(dashboard.food_avg_stats || []).map((item, idx) => (
                    <Grid item xs={12} md={6} key={`${item.food_name || 'food'}-${idx}`}>
                      <Card sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                        <CardContent>
                          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: '#0F172A', mb: 2 }}>
                            {item.food_name}
                          </Typography>
                          <Grid container spacing={2}>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>打饭均值</Typography>
                              <Typography sx={{ fontWeight: 700, color: '#3B82F6' }}>{item.avg_served_g} g</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>摄入均值</Typography>
                              <Typography sx={{ fontWeight: 700, color: '#10B981' }}>{item.avg_intake_g} g</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>剩余均值</Typography>
                              <Typography sx={{ fontWeight: 700, color: '#F59E0B' }}>{item.avg_leftover_g} g</Typography>
                            </Grid>
                            <Grid item xs={6}>
                              <Typography variant="caption" sx={{ color: '#64748B' }}>平均速度</Typography>
                              <Typography sx={{ fontWeight: 700, color: '#8B5CF6' }}>{item.avg_speed_g_per_min} g/min</Typography>
                            </Grid>
                          </Grid>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                  {(!dashboard.food_avg_stats || dashboard.food_avg_stats.length === 0) && (
                    <Grid item xs={12}>
                      <Alert severity="info" sx={{ borderRadius: 2 }}>该社区暂无足够的菜品统计数据</Alert>
                    </Grid>
                  )}
                </Grid>
              </Box>
            )}
          </TabPanel>
        </CardContent>
      </Card>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </Box>
  );
}
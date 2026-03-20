import { useState } from 'react';
import {
  Container,
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Typography,
  Tab,
  Tabs,
  Grid,
  Paper,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  Login as LoginIcon,
  BarChart as ChartIcon,
} from '@mui/icons-material';
import { createCommunity, joinCommunity, fetchCommunityDashboard } from '../api/communities';
import ChartBlock from '../components/ChartBlock';

function TabPanel(props) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`tabpanel-${index}`}
      aria-labelledby={`tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ pt: 3 }}>{children}</Box>}
    </div>
  );
}

export default function Community() {
  const [activeTab, setActiveTab] = useState(0); // 0=menu, 1=create, 2=join, 3=dashboard
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // 创建社区
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createdCommunityId, setCreatedCommunityId] = useState(null);

  // 加入社区
  const [joinForm, setJoinForm] = useState({ communityId: '' });
  const [joinedCommunity, setJoinedCommunity] = useState(null);

  // 仪表板数据
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardCommunityId, setDashboardCommunityId] = useState('');

  // 创建社区处理
  const handleCreateCommunity = async () => {
    if (!createForm.name.trim()) {
      setError('社区名称不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createCommunity(createForm.name, createForm.description);
      setCreatedCommunityId(res.community_id);
      setMessage(`✓ ${res.message} (ID: ${res.community_id})`);
      setCreateForm({ name: '', description: '' });
    } catch (err) {
      setError(err.message || '创建社区失败');
    } finally {
      setLoading(false);
    }
  };

  // 加入社区处理
  const handleJoinCommunity = async () => {
    if (!joinForm.communityId.trim()) {
      setError('社区ID不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await joinCommunity(joinForm.communityId);
      setJoinedCommunity(joinForm.communityId);
      setMessage(`✓ ${res.message}`);
      setJoinForm({ communityId: '' });
    } catch (err) {
      setError(err.message || '加入社区失败');
    } finally {
      setLoading(false);
    }
  };

  // 获取仪表板数据
  const handleFetchDashboard = async () => {
    if (!dashboardCommunityId.trim()) {
      setError('社区ID不能为空');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchCommunityDashboard(dashboardCommunityId);
      setDashboardData(res);
      setMessage(`✓ 已加载社区「${res.community_name}」的数据`);
    } catch (err) {
      setError(err.message || '获取仪表板数据失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
              👥 社区共享
            </Typography>

            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab label="📋 菜单" id="tab-0" aria-controls="tabpanel-0" />
              <Tab label="➕ 创建社区" id="tab-1" aria-controls="tabpanel-1" />
              <Tab label="🔗 加入社区" id="tab-2" aria-controls="tabpanel-2" />
              <Tab label="📊 仪表板" id="tab-3" aria-controls="tabpanel-3" />
            </Tabs>

            {/* 菜单选项卡 */}
            <TabPanel value={activeTab} index={0}>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <Paper
                    sx={{
                      p: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                    onClick={() => setActiveTab(1)}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      📝 创建社区
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      创建一个新的社区，邀请其他用户加入
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Paper
                    sx={{
                      p: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                    onClick={() => setActiveTab(2)}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      🚀 加入社区
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      使用社区ID加入已有的社区
                    </Typography>
                  </Paper>
                </Grid>

                <Grid item xs={12}>
                  <Paper
                    sx={{
                      p: 3,
                      cursor: 'pointer',
                      transition: 'all 0.3s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 3,
                        backgroundColor: '#f5f5f5',
                      },
                    }}
                    onClick={() => setActiveTab(3)}
                  >
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      📊 查看仪表板
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      查看社区聚合看板 - 所有菜品的打饭量、剩余量、摄入量和用餐速度的平均值
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </TabPanel>

            {/* 创建社区选项卡 */}
            <TabPanel value={activeTab} index={1}>
              <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="社区名称 *"
                    placeholder="如：MIT 黑客松健康营"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="社区描述"
                    placeholder="输入社区描述（可选）"
                    multiline
                    rows={4}
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={handleCreateCommunity}
                    disabled={loading}
                  >
                    {loading ? '创建中...' : '创建社区'}
                  </Button>
                </Grid>
                {createdCommunityId && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: '#e8f5e9', border: '1px solid #4caf50' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ✅ 社区创建成功
                      </Typography>
                      <Box sx={{ p: 1, backgroundColor: '#fff', borderRadius: 1, fontFamily: 'monospace', mb: 1 }}>
                        {createdCommunityId}
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        社区ID已复制，请妥善保管并分享给其他用户以邀请他们加入
                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* 加入社区选项卡 */}
            <TabPanel value={activeTab} index={2}>
              <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="社区ID *"
                    placeholder="输入要加入的社区ID"
                    value={joinForm.communityId}
                    onChange={(e) => setJoinForm({ ...joinForm, communityId: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<LoginIcon />}
                    onClick={handleJoinCommunity}
                    disabled={loading}
                  >
                    {loading ? '加入中...' : '加入社区'}
                  </Button>
                </Grid>
                {joinedCommunity && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        ✅ 成功加入社区
                      </Typography>
                      <Box sx={{ p: 1, backgroundColor: '#fff', borderRadius: 1, fontFamily: 'monospace' }}>
                        {joinedCommunity}
                      </Box>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* 仪表板选项卡 */}
            <TabPanel value={activeTab} index={3}>
              <Grid container spacing={2} sx={{ maxWidth: 500, mb: 3 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="社区ID *"
                    placeholder="输入社区ID"
                    value={dashboardCommunityId}
                    onChange={(e) => setDashboardCommunityId(e.target.value)}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    startIcon={<ChartIcon />}
                    onClick={handleFetchDashboard}
                    disabled={loading}
                  >
                    {loading ? '加载中...' : '加载仪表板'}
                  </Button>
                </Grid>
              </Grid>

              {loading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                  <CircularProgress />
                </Box>
              ) : dashboardData ? (
                <Box>
                  <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f0f8ff', border: '1px solid #0066cc' }}>
                    <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                      {dashboardData.community_name}
                    </Typography>
                    <Chip
                      label={`👥 ${dashboardData.member_count} 位成员`}
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </Paper>

                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    菜品统计平均值
                  </Typography>

                  {dashboardData.food_avg_stats && dashboardData.food_avg_stats.length > 0 ? (
                    <Grid container spacing={2}>
                      {dashboardData.food_avg_stats.map((food, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Paper sx={{ p: 2 }}>
                            <Typography variant="body1" sx={{ fontWeight: 'bold', mb: 1.5 }}>
                              {food.food_name}
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  📤 打饭量
                                </Typography>
                                <Chip
                                  label={`${food.avg_served_g.toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  🗑️ 剩余量
                                </Typography>
                                <Chip
                                  label={`${food.avg_leftover_g.toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  🥄 摄入量
                                </Typography>
                                <Chip
                                  label={`${food.avg_intake_g.toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  ⚡ 用餐速度
                                </Typography>
                                <Chip
                                  label={`${food.avg_speed_g_per_min.toFixed(1)}g/min`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Alert severity="info">暂无菜品数据</Alert>
                  )}
                </Box>
              ) : null}
            </TabPanel>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}
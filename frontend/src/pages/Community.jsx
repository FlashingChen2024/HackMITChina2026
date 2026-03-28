import { useState, useEffect } from 'react';
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
  List,
  ListItem,
  ListItemText,
  Divider,
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Add as AddIcon,
  Login as LoginIcon,
  BarChart as ChartIcon,
  Groups as GroupsIcon,
  ContentCopy as CopyIcon,
  Restaurant as RestaurantIcon,
  Speed as SpeedIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { createCommunity, joinCommunity, listCommunities, getCommunityDashboard } from '../api/communities';
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
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  // 我的社区列表
  const [myCommunities, setMyCommunities] = useState([]);
  const [loadingCommunities, setLoadingCommunities] = useState(false);

  // 创建社区
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createdCommunityId, setCreatedCommunityId] = useState(null);

  // 加入社区
  const [joinForm, setJoinForm] = useState({ communityId: '' });
  const [joinedCommunity, setJoinedCommunity] = useState(null);

  // 仪表板数据
  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardCommunityId, setDashboardCommunityId] = useState('');
  const [dashboardChartOption, setDashboardChartOption] = useState(null);

  // 加载我的社区列表
  const loadMyCommunities = async () => {
    setLoadingCommunities(true);
    try {
      const res = await listCommunities();
      setMyCommunities(res.items || []);
    } catch (err) {
      console.error('加载社区列表失败:', err);
    } finally {
      setLoadingCommunities(false);
    }
  };

  // 初始加载
  useEffect(() => {
    loadMyCommunities();
  }, []);

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
      const res = await createCommunity({ name: createForm.name, description: createForm.description });
      const newId = res.community_id || '';
      setCreatedCommunityId(newId);
      let copied = false;
      if (newId) {
        try {
          await navigator.clipboard.writeText(newId);
          copied = true;
        } catch (clipErr) {
          console.warn('自动复制社区 ID 失败:', clipErr);
        }
      }
      setMessage(
        copied
          ? `✓ ${res.message}，社区 ID 已自动复制到剪贴板`
          : newId
            ? `✓ ${res.message} (ID: ${newId})，请手动复制 ID`
            : `✓ ${res.message}`,
      );
      setCreateForm({ name: '', description: '' });
      loadMyCommunities();
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
      // 刷新社区列表
      loadMyCommunities();
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
      const res = await getCommunityDashboard(dashboardCommunityId);
      setDashboardData(res);
      setMessage(`✓ 已加载社区「${res.community_name}」的数据`);
      
      // 生成图表配置
      if (res.food_avg_stats && res.food_avg_stats.length > 0) {
        const chartOption = generateDashboardChart(res.food_avg_stats);
        setDashboardChartOption(chartOption);
      }
    } catch (err) {
      setError(err.message || '获取仪表板数据失败');
      setDashboardData(null);
      setDashboardChartOption(null);
    } finally {
      setLoading(false);
    }
  };

  // 生成社区仪表板图表
  const generateDashboardChart = (foodStats) => {
    const foodNames = foodStats.map(f => f.food_name);
    const servedData = foodStats.map(f => Number(f.avg_served_g) || 0);
    const intakeData = foodStats.map(f => Number(f.avg_intake_g) || 0);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderColor: '#E2E8F0',
        textStyle: { color: '#1E293B' },
        borderRadius: 8
      },
      legend: {
        data: ['平均打饭量', '平均摄入量'],
        bottom: 0,
        textStyle: { color: '#64748B' }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '15%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: foodNames,
        axisLabel: {
          color: '#64748B',
          rotate: 30,
          fontSize: 11
        },
        axisLine: { lineStyle: { color: '#E2E8F0' } }
      },
      yAxis: {
        type: 'value',
        name: '重量(g)',
        nameTextStyle: { color: '#64748B' },
        splitLine: { lineStyle: { type: 'dashed', color: '#E2E8F0' } }
      },
      series: [
        {
          name: '平均打饭量',
          type: 'bar',
          data: servedData,
          itemStyle: { color: '#3B82F6', borderRadius: [4, 4, 0, 0] }
        },
        {
          name: '平均摄入量',
          type: 'bar',
          data: intakeData,
          itemStyle: { color: '#10B981', borderRadius: [4, 4, 0, 0] }
        }
      ]
    };
  };

  // 复制社区ID到剪贴板
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setMessage('✓ 已复制到剪贴板');
    setTimeout(() => setMessage(null), 2000);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <GroupsIcon />
              </Avatar>
              <Box>
                <Typography variant="h5" sx={{ fontWeight: 700 }}>
                  社区圈子
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  加入社区，与志同道合的朋友一起分享健康饮食
                </Typography>
              </Box>
            </Box>

            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab label="我的社区" id="tab-0" />
              <Tab label="创建社区" id="tab-1" />
              <Tab label="加入社区" id="tab-2" />
              <Tab label="社区大屏" id="tab-3" />
            </Tabs>

            {/* 我的社区选项卡 */}
            <TabPanel value={activeTab} index={0}>
              {loadingCommunities ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                  <CircularProgress />
                </Box>
              ) : myCommunities.length > 0 ? (
                <Grid container spacing={3}>
                  {myCommunities.map((community) => (
                    <Grid item xs={12} sm={6} md={4} key={community.community_id}>
                      <Card 
                        variant="outlined"
                        sx={{ 
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          '&:hover': { boxShadow: 3, transform: 'translateY(-2px)' }
                        }}
                        onClick={() => {
                          setDashboardCommunityId(community.community_id);
                          setActiveTab(3);
                          handleFetchDashboard();
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
                            {community.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                            {community.description || '暂无描述'}
                          </Typography>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Chip 
                              size="small" 
                              icon={<GroupsIcon fontSize="small" />}
                              label={`${community.member_count} 位成员`}
                              color="primary"
                              variant="outlined"
                            />
                            <Tooltip title="复制社区ID">
                              <IconButton 
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyToClipboard(community.community_id);
                                }}
                              >
                                <CopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                          <Typography 
                            variant="caption" 
                            sx={{ 
                              display: 'block', 
                              mt: 1, 
                              color: 'text.secondary',
                              fontFamily: 'monospace'
                            }}
                          >
                            ID: {community.community_id}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))}
                </Grid>
              ) : (
                <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50' }}>
                  <GroupsIcon sx={{ fontSize: 48, color: 'grey.400', mb: 2 }} />
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
                    size="large"
                  >
                    {loading ? '创建中...' : '创建社区'}
                  </Button>
                </Grid>
                {createdCommunityId && (
                  <Grid item xs={12}>
                    <Alert severity="success" sx={{ mt: 2 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                        ✅ 社区创建成功
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <code style={{ background: '#f5f5f5', padding: '4px 8px', borderRadius: 4 }}>
                          {createdCommunityId}
                        </code>
                        <Button 
                          size="small" 
                          startIcon={<CopyIcon />}
                          onClick={() => copyToClipboard(createdCommunityId)}
                        >
                          复制
                        </Button>
                      </Box>
                    </Alert>
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
                    size="large"
                  >
                    {loading ? '加入中...' : '加入社区'}
                  </Button>
                </Grid>
                {joinedCommunity && (
                  <Grid item xs={12}>
                    <Alert severity="success" sx={{ mt: 2 }}>
                      ✅ 成功加入社区 {joinedCommunity}
                    </Alert>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* 社区大屏选项卡 */}
            <TabPanel value={activeTab} index={3}>
              <Grid container spacing={2} sx={{ maxWidth: 500, mb: 3 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="社区ID *"
                    placeholder="输入社区ID查看数据"
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
                    size="large"
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
                  {/* 社区信息头部 */}
                  <Paper sx={{ p: 3, mb: 3, bgcolor: 'primary.main', color: 'white' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {dashboardData.community_name}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                      <Chip
                        icon={<GroupsIcon />}
                        label={`${dashboardData.member_count} 位成员`}
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                      />
                      <Chip
                        icon={<RestaurantIcon />}
                        label={`${dashboardData.food_avg_stats?.length || 0} 种菜品`}
                        sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
                      />
                    </Box>
                  </Paper>

                  {/* 图表区域 */}
                  {dashboardChartOption && (
                    <Card sx={{ mb: 3 }}>
                      <CardContent>
                        <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                          菜品摄入对比图
                        </Typography>
                        <Box sx={{ width: '100%', height: 400 }}>
                          <ChartBlock option={dashboardChartOption} height="400px" />
                        </Box>
                      </CardContent>
                    </Card>
                  )}

                  {/* 菜品统计列表 */}
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                    菜品统计详情
                  </Typography>

                  {dashboardData.food_avg_stats && dashboardData.food_avg_stats.length > 0 ? (
                    <Grid container spacing={2}>
                      {dashboardData.food_avg_stats.map((food, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={idx}>
                          <Card variant="outlined">
                            <CardContent>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2 }}>
                                {food.food_name}
                              </Typography>
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <TrendingIcon fontSize="small" color="primary" />
                                    <Typography variant="body2" color="text.secondary">
                                      平均打饭量
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={`${Number(food.avg_served_g).toFixed(1)}g`}
                                    size="small"
                                    color="primary"
                                    variant="outlined"
                                  />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <RestaurantIcon fontSize="small" color="success" />
                                    <Typography variant="body2" color="text.secondary">
                                      平均摄入量
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={`${Number(food.avg_intake_g).toFixed(1)}g`}
                                    size="small"
                                    color="success"
                                    variant="outlined"
                                  />
                                </Box>
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <SpeedIcon fontSize="small" color="warning" />
                                    <Typography variant="body2" color="text.secondary">
                                      平均速度
                                    </Typography>
                                  </Box>
                                  <Chip
                                    label={`${Number(food.avg_speed_g_per_min).toFixed(1)}g/min`}
                                    size="small"
                                    color="warning"
                                    variant="outlined"
                                  />
                                </Box>
                              </Box>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                  ) : (
                    <Alert severity="info">暂无菜品统计数据</Alert>
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

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

  // 鍒涘缓绀惧尯
  const [createForm, setCreateForm] = useState({ name: '', description: '' });
  const [createdCommunityId, setCreatedCommunityId] = useState(null);

  // 鍔犲叆绀惧尯
  const [joinForm, setJoinForm] = useState({ communityId: '' });
  const [joinedCommunity, setJoinedCommunity] = useState(null);

  // 浠〃鏉挎暟鎹?  const [dashboardData, setDashboardData] = useState(null);
  const [dashboardCommunityId, setDashboardCommunityId] = useState('');

  // 鍒涘缓绀惧尯澶勭悊
  const handleCreateCommunity = async () => {
    if (!createForm.name.trim()) {
      setError('绀惧尯鍚嶇О涓嶈兘涓虹┖');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await createCommunity({ name: createForm.name, description: createForm.description });
      setCreatedCommunityId(res.community_id);
      setMessage(`鉁?${res.message} (ID: ${res.community_id})`);
      setCreateForm({ name: '', description: '' });
    } catch (err) {
      setError(err.message || '鍒涘缓绀惧尯澶辫触');
    } finally {
      setLoading(false);
    }
  };

  // 鍔犲叆绀惧尯澶勭悊
  const handleJoinCommunity = async () => {
    if (!joinForm.communityId.trim()) {
      setError('绀惧尯ID涓嶈兘涓虹┖');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await joinCommunity(joinForm.communityId);
      setJoinedCommunity(joinForm.communityId);
      setMessage(`鉁?${res.message}`);
      setJoinForm({ communityId: '' });
    } catch (err) {
      setError(err.message || '鍔犲叆绀惧尯澶辫触');
    } finally {
      setLoading(false);
    }
  };

  // 鑾峰彇浠〃鏉挎暟鎹?  const handleFetchDashboard = async () => {
    if (!dashboardCommunityId.trim()) {
      setError('绀惧尯ID涓嶈兘涓虹┖');
      return;
    }
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetchCommunityDashboard(dashboardCommunityId);
      setDashboardData(res);
      setMessage(`鉁?宸插姞杞界ぞ鍖恒€?{res.community_name}銆嶇殑鏁版嵁`);
    } catch (err) {
      setError(err.message || '鑾峰彇浠〃鏉挎暟鎹け璐?);
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
              馃懃 绀惧尯鍏变韩
            </Typography>

            {message && <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>}
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <Tabs
              value={activeTab}
              onChange={(e, newValue) => setActiveTab(newValue)}
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              <Tab label="馃搵 鑿滃崟" id="tab-0" aria-controls="tabpanel-0" />
              <Tab label="鉃?鍒涘缓绀惧尯" id="tab-1" aria-controls="tabpanel-1" />
              <Tab label="馃敆 鍔犲叆绀惧尯" id="tab-2" aria-controls="tabpanel-2" />
              <Tab label="馃搳 浠〃鏉? id="tab-3" aria-controls="tabpanel-3" />
            </Tabs>

            {/* 鑿滃崟閫夐」鍗?*/}
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
                      馃摑 鍒涘缓绀惧尯
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      鍒涘缓涓€涓柊鐨勭ぞ鍖猴紝閭€璇峰叾浠栫敤鎴峰姞鍏?                    </Typography>
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
                      馃殌 鍔犲叆绀惧尯
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      浣跨敤绀惧尯ID鍔犲叆宸叉湁鐨勭ぞ鍖?                    </Typography>
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
                      馃搳 鏌ョ湅浠〃鏉?                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      鏌ョ湅绀惧尯鑱氬悎鐪嬫澘 - 鎵€鏈夎彍鍝佺殑鎵撻キ閲忋€佸墿浣欓噺銆佹憚鍏ラ噺鍜岀敤椁愰€熷害鐨勫钩鍧囧€?                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </TabPanel>

            {/* 鍒涘缓绀惧尯閫夐」鍗?*/}
            <TabPanel value={activeTab} index={1}>
              <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="绀惧尯鍚嶇О *"
                    placeholder="濡傦細MIT 榛戝鏉惧仴搴疯惀"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="绀惧尯鎻忚堪"
                    placeholder="杈撳叆绀惧尯鎻忚堪锛堝彲閫夛級"
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
                    {loading ? '鍒涘缓涓?..' : '鍒涘缓绀惧尯'}
                  </Button>
                </Grid>
                {createdCommunityId && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: '#e8f5e9', border: '1px solid #4caf50' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        鉁?绀惧尯鍒涘缓鎴愬姛
                      </Typography>
                      <Box sx={{ p: 1, backgroundColor: '#fff', borderRadius: 1, fontFamily: 'monospace', mb: 1 }}>
                        {createdCommunityId}
                      </Box>
                      <Typography variant="caption" color="textSecondary">
                        绀惧尯ID宸插鍒讹紝璇峰Ε鍠勪繚绠″苟鍒嗕韩缁欏叾浠栫敤鎴蜂互閭€璇蜂粬浠姞鍏?                      </Typography>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* 鍔犲叆绀惧尯閫夐」鍗?*/}
            <TabPanel value={activeTab} index={2}>
              <Grid container spacing={2} sx={{ maxWidth: 500 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="绀惧尯ID *"
                    placeholder="杈撳叆瑕佸姞鍏ョ殑绀惧尯ID"
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
                    {loading ? '鍔犲叆涓?..' : '鍔犲叆绀惧尯'}
                  </Button>
                </Grid>
                {joinedCommunity && (
                  <Grid item xs={12}>
                    <Paper sx={{ p: 2, backgroundColor: '#e3f2fd', border: '1px solid #2196f3' }}>
                      <Typography variant="body2" sx={{ fontWeight: 'bold', mb: 1 }}>
                        鉁?鎴愬姛鍔犲叆绀惧尯
                      </Typography>
                      <Box sx={{ p: 1, backgroundColor: '#fff', borderRadius: 1, fontFamily: 'monospace' }}>
                        {joinedCommunity}
                      </Box>
                    </Paper>
                  </Grid>
                )}
              </Grid>
            </TabPanel>

            {/* 浠〃鏉块€夐」鍗?*/}
            <TabPanel value={activeTab} index={3}>
              <Grid container spacing={2} sx={{ maxWidth: 500, mb: 3 }}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="绀惧尯ID *"
                    placeholder="杈撳叆绀惧尯ID"
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
                    {loading ? '鍔犺浇涓?..' : '鍔犺浇浠〃鏉?}
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
                      label={`馃懃 ${dashboardData.member_count} 浣嶆垚鍛榒}
                      color="primary"
                      sx={{ mt: 1 }}
                    />
                  </Paper>

                  <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                    鑿滃搧缁熻骞冲潎鍊?                  </Typography>

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
                                  馃摛 鎵撻キ閲?                                </Typography>
                                <Chip
                                  label={`${food.avg_served_g.toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  馃棏锔?鍓╀綑閲?                                </Typography>
                                <Chip
                                  label={`${(food.avg_leftover_g ?? Math.max(Number(food.avg_served_g || 0) - Number(food.avg_intake_g || 0), 0)).toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                  color="error"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  馃 鎽勫叆閲?                                </Typography>
                                <Chip
                                  label={`${food.avg_intake_g.toFixed(1)}g`}
                                  size="small"
                                  variant="outlined"
                                  color="success"
                                />
                              </Box>
                              <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                                <Typography variant="caption" color="textSecondary">
                                  鈿?鐢ㄩ閫熷害
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
                    <Alert severity="info">鏆傛棤鑿滃搧鏁版嵁</Alert>
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

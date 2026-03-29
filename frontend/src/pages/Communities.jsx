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

  // My community list
  const [myCommunities, setMyCommunities] = useState([]);
  const [loadingMyCommunities, setLoadingMyCommunities] = useState(false);

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  const [joinId, setJoinId] = useState('');

  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  // Load my communities
  const loadMyCommunities = async () => {
    setLoadingMyCommunities(true);
    try {
      const res = await listCommunities();
      setMyCommunities(res.items || []);
    } catch (err) {
      console.error('Failed to load community list:', err);
    } finally {
      setLoadingMyCommunities(false);
    }
  };

  // Initial load
  useEffect(() => {
    loadMyCommunities();
  }, []);

  const clearMessages = () => {
    setError('');
    setSuccess('');
  };

  // Copy to clipboard
  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard.');
    setTimeout(() => setSuccess(''), 2000);
  };

  // Go to community dashboard
  const goToDashboard = (communityId) => {
    setDashboardId(communityId);
    setActiveTab(3);
    // Auto-load dashboard
    setTimeout(() => {
      handleLoadDashboardById(communityId);
    }, 100);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;

    const trimmedName = createName.trim();
    setLoading(true);
    clearMessages();
    try {
      const res = await createCommunity({
        name: trimmedName,
        description: createDesc.trim(),
      });
      const newId = res.community_id || '';
      setLastCreatedId(newId);
      setCreateName('');
      setCreateDesc('');

      let copied = false;
      if (newId) {
        try {
          await navigator.clipboard.writeText(newId);
          copied = true;
        } catch (clipErr) {
          console.warn('Auto-copy community ID failed:', clipErr);
        }
      }

      setSuccess(
        copied
          ? `Community "${trimmedName}" created. Community ID copied to clipboard.`
          : newId
            ? `Community "${trimmedName}" created. Use the button below to copy the ID.`
            : `Community "${trimmedName}" created.`,
      );

      loadMyCommunities();
    } catch (err) {
      setError(err.message || 'Failed to create community.');
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
      setSuccess('Joined community successfully.');
      setDashboardId(cid);
      setJoinId('');
      // Refresh community list
      loadMyCommunities();
      setTimeout(() => setActiveTab(3), 500);
    } catch (err) {
      setError(err.message || 'Failed to join community.');
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
      setError(err.message || 'Failed to load community dashboard.');
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
          Communities
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>
          Create or join communities and view aggregated dashboards.
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
            <Tab icon={<PeopleIcon />} iconPosition="start" label="My Communities" />
            <Tab icon={<AddIcon />} iconPosition="start" label="Create" />
            <Tab icon={<JoinIcon />} iconPosition="start" label="Join" />
            <Tab icon={<DashboardIcon />} iconPosition="start" label="Dashboard" />
          </Tabs>
        </Box>

        <CardContent>
          {/* My communities tab */}
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
                          {community.description || 'No description'}
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
                          <Tooltip title="Copy Community ID">
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
                          View Dashboard
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
                  You have not joined any communities yet.
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Create a new community or join one to start sharing.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
                  <Button variant="contained" onClick={() => setActiveTab(1)}>
                    Create
                  </Button>
                  <Button variant="outlined" onClick={() => setActiveTab(2)}>
                    Join
                  </Button>
                </Box>
              </Paper>
            )}
          </TabPanel>

          {/* Create tab */}
          <TabPanel value={activeTab} index={1}>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Box
                component="form"
                onSubmit={onCreate}
                sx={{ width: '100%', maxWidth: 560, display: 'grid', gap: 2 }}
              >
                <TextField
                  label="Community Name"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  required
                />
                <TextField
                  label="Description"
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  multiline
                  minRows={3}
                />
                <Button type="submit" variant="contained" disabled={loading || !createName.trim()}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Create Community'}
                </Button>
              </Box>

              {lastCreatedId && (
                <Paper
                  sx={{
                    mt: 3,
                    p: 3,
                    width: '100%',
                    maxWidth: 560,
                    bgcolor: '#F0FDF4',
                    border: '1px solid #86EFAC',
                  }}
                >
                  <Typography variant="body2" sx={{ color: '#166534', mb: 1 }}>
                    Community created successfully.
                  </Typography>
                  <Typography variant="body2" sx={{ color: '#64748B', mb: 1 }}>
                    Community ID (auto-copied on create; you can copy again here):
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
                      Copy ID
                    </Button>
                  </Box>
                </Paper>
              )}
            </Box>
          </TabPanel>

          {/* Join tab */}
          <TabPanel value={activeTab} index={2}>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Box
                component="form"
                onSubmit={onJoin}
                sx={{ width: '100%', maxWidth: 560, display: 'grid', gap: 2 }}
              >
                <TextField
                  label="Community ID"
                  value={joinId}
                  onChange={(e) => setJoinId(e.target.value)}
                  placeholder="Example: COMM_12345"
                  required
                />
                <Button type="submit" variant="contained" disabled={loading || !joinId.trim()}>
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Join Community'}
                </Button>
              </Box>
            </Box>
          </TabPanel>

          {/* Dashboard tab */}
          <TabPanel value={activeTab} index={3}>
            <Box
              sx={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <Box
                component="form"
                onSubmit={onLoadDashboard}
                sx={{
                  width: '100%',
                  maxWidth: 680,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 2,
                  mb: 3,
                  alignItems: { xs: 'stretch', sm: 'flex-start' },
                }}
              >
                <TextField
                  label="Community ID"
                  value={dashboardId}
                  onChange={(e) => setDashboardId(e.target.value)}
                  fullWidth
                  sx={{ flex: { xs: '1 1 100%', sm: '1 1 0' }, minWidth: { sm: 0 } }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  disabled={loading || !dashboardId.trim()}
                  sx={{ flexShrink: 0, alignSelf: { xs: 'stretch', sm: 'center' } }}
                >
                  {loading ? <CircularProgress size={20} color="inherit" /> : 'Load Dashboard'}
                </Button>
              </Box>

              {dashboard && (
                <Box sx={{ width: '100%', maxWidth: 1000 }}>
                  <Paper sx={{ p: 3, mb: 3, bgcolor: '#1a1a2e', color: '#fff' }}>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{dashboard.community_name}</Typography>
                    <Typography variant="body2" sx={{ opacity: 0.9 }}>ID: {dashboard.community_id}</Typography>
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, mt: 2 }}>
                      <PeopleIcon fontSize="small" />
                      <Typography variant="body2">Members: {dashboard.member_count}</Typography>
                    </Box>
                  </Paper>

                  <Grid container spacing={2}>
                    {(dashboard.food_avg_stats || []).map((item, idx) => {
                      const leftover = item.avg_leftover_g ?? Math.max(Number(item.avg_served_g || 0) - Number(item.avg_intake_g || 0), 0);
                      return (
                        <Grid item xs={12} md={6} key={`${item.food_name || 'food'}-${idx}`}>
                          <Card sx={{ bgcolor: '#F8FAFC', border: '1px solid #E2E8F0', boxShadow: 'none' }}>
                            <CardContent>
                              <Typography sx={{ fontWeight: 700, mb: 1 }}>{item.food_name || 'Unknown food'}</Typography>
                              <Typography variant="body2">Avg Served: {formatGrams(item.avg_served_g)}</Typography>
                              <Typography variant="body2">Avg Intake: {formatGrams(item.avg_intake_g)}</Typography>
                              <Typography variant="body2">Avg Leftover: {formatGrams(leftover)}</Typography>
                              <Typography variant="body2">Avg Speed: {Number(item.avg_speed_g_per_min || 0).toFixed(1)} g/min</Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      );
                    })}
                  </Grid>

                  {(!dashboard.food_avg_stats || dashboard.food_avg_stats.length === 0) && (
                    <Alert severity="info" sx={{ mt: 2 }}>No food statistics available for this community.</Alert>
                  )}
                </Box>
              )}

              {!dashboard && !loading && (
                <Box sx={{ width: '100%', maxWidth: 560, textAlign: 'center', py: 4 }}>
                  <Avatar sx={{ mx: 'auto', mb: 1, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
                    <DashboardIcon />
                  </Avatar>
                  <Typography sx={{ color: '#64748B' }}>Enter a community ID to view the aggregated dashboard.</Typography>
                </Box>
              )}
            </Box>
          </TabPanel>
        </CardContent>
      </Card>
    </Box>
  );
}

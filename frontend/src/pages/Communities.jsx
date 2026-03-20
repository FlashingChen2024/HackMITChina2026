import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemText,
  Stack,
  TextField,
  Typography
} from '@mui/material';
import {
  createCommunity,
  joinCommunity,
  getCommunityDashboard
} from '../api/communities';

export default function Communities() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [lastCreatedId, setLastCreatedId] = useState('');

  const [joinId, setJoinId] = useState('');
  const [dashboardId, setDashboardId] = useState('');
  const [dashboard, setDashboard] = useState(null);

  /**
   * 创建社区并返回社区 ID
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onCreate = async (e) => {
    e.preventDefault();
    if (!createName.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await createCommunity({ name: createName.trim(), description: createDesc.trim() });
      setLastCreatedId(res.community_id || '');
      setDashboardId(res.community_id || '');
      setSuccess(`创建成功，社区 ID：${res.community_id || '-'}`);
      setCreateName('');
      setCreateDesc('');
    } catch (err) {
      setError(err.message || '创建失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 按 community_id 加入社区
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onJoin = async (e) => {
    e.preventDefault();
    if (!joinId.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await joinCommunity(joinId.trim().toUpperCase());
      setSuccess('加入成功');
      setDashboardId(joinId.trim().toUpperCase());
      setJoinId('');
    } catch (err) {
      setError(err.message || '加入失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 获取社区聚合看板
   * @param {React.FormEvent<HTMLFormElement>} e
   * @returns {Promise<void>}
   */
  const onLoadDashboard = async (e) => {
    e.preventDefault();
    if (!dashboardId.trim()) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await getCommunityDashboard(dashboardId.trim().toUpperCase());
      setDashboard(res || null);
      setSuccess('已加载社区看板');
    } catch (err) {
      setDashboard(null);
      setError(err.message || '加载社区看板失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Stack spacing={2}>
      <Card>
        <CardContent>
          <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>社区功能</Typography>
          <Typography variant="body2" color="text.secondary">
            创建社区会返回一个社区 ID，其他人需要输入该 ID 才能加入。
          </Typography>
          <Typography variant="body2" color="text.secondary">
            本页已按规范对齐 3 个接口：创建、加入、社区看板。
          </Typography>
          {loading && <Alert severity="info" sx={{ mt: 2 }}>处理中...</Alert>}
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>创建社区</Typography>
          <Box component="form" onSubmit={onCreate} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="社区名称" value={createName} onChange={(e) => setCreateName(e.target.value)} />
            <TextField label="社区简介" value={createDesc} onChange={(e) => setCreateDesc(e.target.value)} />
            <Button type="submit" variant="contained" disabled={loading || !createName.trim()}>创建</Button>
          </Box>
          {lastCreatedId && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              最近创建的社区 ID：{lastCreatedId}
            </Typography>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>加入社区</Typography>
          <Box component="form" onSubmit={onJoin} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField label="社区 ID" placeholder="例如 C8F3A1B2" value={joinId} onChange={(e) => setJoinId(e.target.value)} />
            <Button type="submit" variant="contained" disabled={loading || !joinId.trim()}>加入</Button>
          </Box>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2 }}>社区大屏聚合看板</Typography>
          <Box component="form" onSubmit={onLoadDashboard} sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <TextField
              label="社区 ID"
              placeholder="输入 community_id"
              value={dashboardId}
              onChange={(e) => setDashboardId(e.target.value)}
            />
            <Button type="submit" variant="contained" disabled={loading || !dashboardId.trim()}>查看看板</Button>
          </Box>

          {!dashboard ? (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              输入社区 ID 并点击“查看看板”后显示聚合数据。
            </Typography>
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                社区：{dashboard.community_name}（ID: {dashboard.community_id}） | 成员数：{dashboard.member_count}
              </Typography>
              <List>
                {(dashboard.food_avg_stats || []).map((item, idx) => (
                  <ListItem key={`${item.food_name || 'food'}-${idx}`} divider>
                    <ListItemText
                      primary={item.food_name}
                      secondary={`打饭均值：${item.avg_served_g} g | 剩余均值：${item.avg_leftover_g} g | 摄入均值：${item.avg_intake_g} g | 平均速度：${item.avg_speed_g_per_min} g/min`}
                    />
                  </ListItem>
                ))}
              </List>
            </Box>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
}


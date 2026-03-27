import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card, CardContent, Typography, Button, Alert, CircularProgress, Box, Chip, Grid,
  Avatar, Divider, IconButton, Tooltip, TextField, Stack, MenuItem
} from '@mui/material';
import { 
  Refresh as RefreshIcon, 
  Restaurant as MealIcon,
  Timer as TimerIcon,
  LocalFireDepartment as CalorieIcon,
  AccessTime as TimeIcon,
  PhotoCamera as CameraIcon,
  StopCircle as StopCameraIcon,
  Send as SendIcon
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals, updateMealFoods } from '../api/meals';

export default function Meals() {
  const currentUser = getCurrentUser();
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [activeCaptureGrid, setActiveCaptureGrid] = useState(1);
  const [autoAdvanceCapture, setAutoAdvanceCapture] = useState(true);
  const [gridSnapshots, setGridSnapshots] = useState({
    1: '',
    2: '',
    3: '',
    4: '',
  });
  const [selectedMealId, setSelectedMealId] = useState('');
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [gridInputs, setGridInputs] = useState([
    { grid_index: 1, food_name: '', unit_cal_per_100g: '' },
    { grid_index: 2, food_name: '', unit_cal_per_100g: '' },
    { grid_index: 3, food_name: '', unit_cal_per_100g: '' },
    { grid_index: 4, food_name: '', unit_cal_per_100g: '' },
  ]);

  const load = async (cursor = '') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchMeals({ cursor, limit: 20 });
      const list = res.items || [];
      const next = res.next_cursor || '';
      if (cursor) {
        setItems(prev => [...prev, ...list]);
      } else {
        setItems(list);
      }
      setNextCursor(next);
    } catch (e) {
      setError(e.message);
      if (!cursor) setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!cameraOpen || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    videoRef.current.play().catch(() => {
      setCameraError('摄像头已连接，但自动播放失败，请重试打开摄像头');
    });
  }, [cameraOpen]);

  const formatDate = (isoString) => {
    if (!isoString) return '未知时间';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('zh-CN', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  const mealOptions = useMemo(() => items.map((m) => ({
    mealId: m.meal_id,
    label: `${formatDate(m.start_time)} (${m.meal_id})`,
  })), [items]);

  /**
   * 打开摄像头流并渲染到视频组件。
   * @returns {Promise<void>}
   */
  const startCamera = async () => {
    setCameraError('');
    setSubmitResult('');
    setCameraReady(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
    } catch (e) {
      setCameraError(e.message || '无法访问摄像头');
    }
  };

  /**
   * 停止摄像头采集并释放轨道资源。
   * @returns {void}
   */
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    setCameraReady(false);
  };

  /**
   * 将当前视频帧截图为 base64，用于用户确认识别内容。
   * @returns {void}
   */
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !cameraReady) {
      setCameraError('摄像头还在初始化，请等待画面出现后再拍照');
      return;
    }
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('摄像头画面不可用，请重新打开摄像头后重试');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    setCameraError('');
    const snapshot = canvas.toDataURL('image/jpeg', 0.9);
    setGridSnapshots((prev) => ({
      ...prev,
      [activeCaptureGrid]: snapshot,
    }));
    if (autoAdvanceCapture) {
      setActiveCaptureGrid((prev) => (prev === 4 ? 1 : prev + 1));
    }
  };

  /**
   * 更新某个格口的食物名称或单位热量输入。
   * @param {number} gridIndex
   * @param {'food_name' | 'unit_cal_per_100g'} key
   * @param {string} value
   * @returns {void}
   */
  const updateGridInput = (gridIndex, key, value) => {
    setGridInputs((prev) => prev.map((grid) => {
      if (grid.grid_index !== gridIndex) return grid;
      return { ...grid, [key]: value };
    }));
  };

  /**
   * 提交已确认的食物信息到后端计算卡路里。
   * @returns {Promise<void>}
   */
  const submitFoods = async () => {
    setSubmitResult('');
    setError(null);
    const selected = gridInputs
      .filter((grid) => grid.food_name.trim() !== '' && grid.unit_cal_per_100g !== '')
      .map((grid) => ({
        grid_index: grid.grid_index,
        food_name: grid.food_name.trim(),
        unit_cal_per_100g: Number(grid.unit_cal_per_100g),
      }));

    if (!selectedMealId) {
      setError('请先选择要挂载食物信息的餐次');
      return;
    }
    if (Object.values(gridSnapshots).every((snapshot) => !snapshot)) {
      setError('请先完成至少一个格口的拍照，再提交食物识别结果');
      return;
    }
    if (selected.length === 0) {
      setError('请至少填写一个格口的食物名称和单位卡路里');
      return;
    }
    if (selected.some((item) => Number.isNaN(item.unit_cal_per_100g) || item.unit_cal_per_100g < 0)) {
      setError('单位卡路里必须是大于等于 0 的数字');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await updateMealFoods(selectedMealId, selected);
      setSubmitResult(res.message || '食物信息挂载成功，卡路里已就绪');
      await load();
    } catch (e) {
      setError(e.message || '提交失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            菜品视觉识别与卡路里点火
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: '#64748B' }}>
            先用摄像头拍照，再填写识别出的菜品与单位卡路里，提交后端进行餐次卡路里挂载。
          </Typography>

          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="目标餐次"
              value={selectedMealId}
              onChange={(e) => setSelectedMealId(e.target.value)}
              helperText="选择要挂载 /meals/{meal_id}/foods 的餐次"
            >
              {mealOptions.map((option) => (
                <MenuItem key={option.mealId} value={option.mealId}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="当前拍照格口"
              value={activeCaptureGrid}
              onChange={(e) => setActiveCaptureGrid(Number(e.target.value))}
              helperText="建议按格口 1~4 依次拍照"
            >
              <MenuItem value={1}>格口 1</MenuItem>
              <MenuItem value={2}>格口 2</MenuItem>
              <MenuItem value={3}>格口 3</MenuItem>
              <MenuItem value={4}>格口 4</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="拍照模式"
              value={autoAdvanceCapture ? 'auto' : 'manual'}
              onChange={(e) => setAutoAdvanceCapture(e.target.value === 'auto')}
              helperText="连拍模式会在每次拍照后自动切换到下一个格口"
            >
              <MenuItem value="auto">连拍模式（自动跳格口）</MenuItem>
              <MenuItem value="manual">手动模式（不自动跳）</MenuItem>
            </TextField>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {!cameraOpen ? (
                <Button variant="contained" startIcon={<CameraIcon />} onClick={startCamera}>
                  打开摄像头
                </Button>
              ) : (
                <Button variant="outlined" color="error" startIcon={<StopCameraIcon />} onClick={stopCamera}>
                  关闭摄像头
                </Button>
              )}
              <Button variant="outlined" onClick={captureSnapshot} disabled={!cameraOpen || !cameraReady}>
                拍摄格口 {activeCaptureGrid}
              </Button>
            </Box>

            {cameraOpen && (
              <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  onLoadedData={() => setCameraReady(true)}
                  style={{ width: '100%', maxHeight: 360, objectFit: 'cover', display: 'block' }}
                />
              </Box>
            )}
            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <Grid container spacing={2}>
              {[1, 2, 3, 4].map((gridIndex) => (
                <Grid item xs={12} md={6} key={`snapshot-${gridIndex}`}>
                  <Card variant="outlined" sx={{ borderColor: '#E2E8F0' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>格口 {gridIndex} 照片</Typography>
                      {gridSnapshots[gridIndex] ? (
                        <Box sx={{ borderRadius: 2, overflow: 'hidden', border: '1px solid #E2E8F0', mb: 1 }}>
                          <img
                            src={gridSnapshots[gridIndex]}
                            alt={`grid-${gridIndex}`}
                            style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block' }}
                          />
                        </Box>
                      ) : (
                        <Box
                          sx={{
                            borderRadius: 2,
                            border: '1px dashed #CBD5E1',
                            color: '#94A3B8',
                            textAlign: 'center',
                            py: 4,
                            mb: 1,
                          }}
                        >
                          未拍照
                        </Box>
                      )}
                      <Button
                        size="small"
                        variant={activeCaptureGrid === gridIndex ? 'contained' : 'outlined'}
                        onClick={() => setActiveCaptureGrid(gridIndex)}
                      >
                        设为当前拍照格口
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Grid container spacing={2}>
              {gridInputs.map((grid) => (
                <Grid item xs={12} md={6} key={grid.grid_index}>
                  <Card variant="outlined" sx={{ borderColor: '#E2E8F0' }}>
                    <CardContent sx={{ p: 2 }}>
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>格口 {grid.grid_index}</Typography>
                      <Stack spacing={1.5}>
                        <TextField
                          size="small"
                          label="食物名称"
                          value={grid.food_name}
                          onChange={(e) => updateGridInput(grid.grid_index, 'food_name', e.target.value)}
                          placeholder="如：西红柿炒鸡蛋"
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="每100g卡路里"
                          value={grid.unit_cal_per_100g}
                          onChange={(e) => updateGridInput(grid.grid_index, 'unit_cal_per_100g', e.target.value)}
                          inputProps={{ min: 0, step: '0.1' }}
                          placeholder="如：80"
                        />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={submitFoods}
                disabled={submitLoading}
              >
                {submitLoading ? '提交中...' : '提交给后端计算卡路里'}
              </Button>
              <Button
                variant="text"
                onClick={() => {
                  setGridInputs([
                    { grid_index: 1, food_name: '', unit_cal_per_100g: '' },
                    { grid_index: 2, food_name: '', unit_cal_per_100g: '' },
                    { grid_index: 3, food_name: '', unit_cal_per_100g: '' },
                    { grid_index: 4, food_name: '', unit_cal_per_100g: '' },
                  ]);
                  setGridSnapshots({ 1: '', 2: '', 3: '', 4: '' });
                  setActiveCaptureGrid(1);
                  setSubmitResult('');
                }}
              >
                清空输入
              </Button>
            </Box>

            {cameraError && <Alert severity="error">{cameraError}</Alert>}
            {submitResult && <Alert severity="success">{submitResult}</Alert>}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>就餐记录</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>回顾您的每一次健康饮食</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {currentUser && (
            <Chip 
              label={currentUser.username} 
              color="primary" 
              variant="outlined" 
              sx={{ fontWeight: 600, bgcolor: 'rgba(0,191,165,0.08)', border: 'none' }} 
            />
          )}
          <Tooltip title="刷新记录">
            <IconButton onClick={() => load()} disabled={loading} sx={{ bgcolor: 'rgba(0,0,0,0.04)' }}>
              <RefreshIcon sx={{ color: '#64748B' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 4, borderRadius: 2 }}>{error}</Alert>}

      {loading && !items.length ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress sx={{ color: '#00BFA5' }} />
        </Box>
      ) : items.length > 0 ? (
        <Grid container spacing={3}>
          {items.map((m) => (
            <Grid item xs={12} key={m.meal_id}>
              <Card sx={{ 
                transition: 'transform 0.2s, box-shadow 0.2s',
                '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }
              }}>
                <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                    <Avatar sx={{ 
                      width: 56, height: 56, 
                      bgcolor: 'rgba(16, 185, 129, 0.1)', color: '#10B981',
                      display: { xs: 'none', sm: 'flex' }
                    }}>
                      <MealIcon fontSize="medium" />
                    </Avatar>
                    
                    <Box sx={{ flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 1 }}>
                          {formatDate(m.start_time)}
                        </Typography>
                        <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                          ID: {m.meal_id}
                        </Typography>
                      </Box>
                      
                      <Divider sx={{ my: 1.5 }} />
                      
                      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                        <Chip
                          icon={<TimeIcon fontSize="small" />}
                          label={new Date(m.start_time).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                          variant="outlined"
                          sx={{ borderColor: '#E2E8F0', color: '#64748B' }}
                        />
                        {m.duration_minutes != null && (
                          <Chip
                            icon={<TimerIcon fontSize="small" />}
                            label={`${m.duration_minutes} 分钟`}
                            variant="outlined"
                            sx={{ borderColor: '#E2E8F0', color: '#64748B' }}
                          />
                        )}
                        {m.total_meal_cal != null && m.total_meal_cal > 0 && (
                          <Chip
                            icon={<CalorieIcon fontSize="small" />}
                            label={`${m.total_meal_cal} kcal`}
                            sx={{ 
                              bgcolor: 'rgba(239, 68, 68, 0.1)', 
                              color: '#EF4444',
                              fontWeight: 600,
                              border: 'none'
                            }}
                          />
                        )}
                      </Box>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
          {nextCursor && (
            <Grid item xs={12} sx={{ textAlign: 'center', mt: 2 }}>
              <Button
                variant="outlined"
                size="large"
                onClick={() => load(nextCursor)}
                disabled={loading}
                sx={{ borderRadius: 8, px: 4 }}
              >
                {loading ? <CircularProgress size={24} color="inherit" /> : '加载更多记录'}
              </Button>
            </Grid>
          )}
        </Grid>
      ) : (
        <Card sx={{ bgcolor: 'rgba(248, 250, 252, 0.8)', border: '1px dashed #CBD5E1', boxShadow: 'none' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: '#F1F5F9', color: '#94A3B8' }}>
              <MealIcon fontSize="large" />
            </Avatar>
            <Typography variant="h6" sx={{ color: '#475569', mb: 1 }}>暂无就餐记录</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', maxWidth: 400, mx: 'auto' }}>
              请先绑定设备并触发遥测数据，或者导入测试数据以查看您的健康饮食记录。
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}
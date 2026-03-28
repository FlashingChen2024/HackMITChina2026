import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Box,
  Chip,
  Grid,
  Avatar,
  Divider,
  IconButton,
  Tooltip,
  TextField,
  Stack,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CardActionArea,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';
import {
  Refresh as RefreshIcon,
  Restaurant as MealIcon,
  Timer as TimerIcon,
  LocalFireDepartment as CalorieIcon,
  AccessTime as TimeIcon,
  PhotoCamera as CameraIcon,
  StopCircle as StopCameraIcon,
  Send as SendIcon,
  AutoAwesome as AiVisionIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { fetchMeals, fetchMealDetail, updateMealFoods, confirmMealVision } from '../api/meals';
import { analyzeVision } from '../api/vision';
import { searchFoodLibrary } from '../api/foodLibrary';
import { compressDataUrlForVision } from '../utils/imageCompress';

/** 目标餐次下拉中「当前餐次」选项的值（非真实 meal_id，提交前需解析） */
const TARGET_MEAL_CURRENT = '__current_meal__';

/**
 * @typedef {object} MealGridDetailRow
 * @property {number} grid_index
 * @property {string} [food_name]
 * @property {number} [served_g]
 * @property {number} [intake_g]
 * @property {number} [leftover_g]
 * @property {number} [total_cal]
 * @property {number} [speed_g_per_min]
 */

/**
 * @typedef {object} MealDetailPayload
 * @property {string} meal_id
 * @property {string} [start_time]
 * @property {number} [duration_minutes]
 * @property {number} [total_meal_cal]
 * @property {MealGridDetailRow[]} [grid_details]
 */

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
  const [visionBusy, setVisionBusy] = useState(false);
  const [submitResult, setSubmitResult] = useState('');
  const [gridInputs, setGridInputs] = useState([
    { grid_index: 1, food_name: '', unit_cal_per_100g: '', food_code: '' },
    { grid_index: 2, food_name: '', unit_cal_per_100g: '', food_code: '' },
    { grid_index: 3, food_name: '', unit_cal_per_100g: '', food_code: '' },
    { grid_index: 4, food_name: '', unit_cal_per_100g: '', food_code: '' },
  ]);

  /** 就餐详情弹窗（§4.3 GET /meals/{meal_id}） */
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [detailMeal, setDetailMeal] = useState(/** @type {MealDetailPayload | null} */ (null));

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

  /**
   * 打开 §4.3 餐次详情（GET /meals/{meal_id}）并展示 grid_details。
   *
   * @param {string} mealId
   * @returns {Promise<void>}
   */
  const openMealDetail = async (mealId) => {
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailError('');
    setDetailMeal(null);
    try {
      const data = await fetchMealDetail(mealId);
      setDetailMeal(data);
    } catch (e) {
      setDetailError(e?.message || '加载用餐详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  /**
   * @returns {void}
   */
  const closeMealDetail = () => {
    setDetailOpen(false);
    setDetailMeal(null);
    setDetailError('');
  };

  const mealOptions = useMemo(() => items.map((m) => ({
    mealId: m.meal_id,
    label: `${formatDate(m.start_time)} (${m.meal_id})`,
  })), [items]);

  /**
   * 将「目标餐次」下拉值解析为实际用于 API 的 meal_id。
   * 选「当前餐次」时使用列表首条（与后端列表一致：按开餐时间倒序，即最新一餐）。
   * @returns {string}
   */
  const resolveTargetMealId = () => {
    if (selectedMealId === TARGET_MEAL_CURRENT) {
      return items[0]?.meal_id ?? '';
    }
    return selectedMealId;
  };

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
   * 更新某个格口的食物名称、热量或食物库编码。
   * @param {number} gridIndex
   * @param {'food_name' | 'unit_cal_per_100g' | 'food_code'} key
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
   * 单格：压缩图 → §9.1 识菜 → §9.2 食物库，回填名称/热量/food_code。
   * @param {number} gridIndex
   * @returns {Promise<void>}
   */
  const recognizeGrid = async (gridIndex) => {
    setCameraError('');
    setSubmitResult('');
    setError(null);
    const snap = gridSnapshots[gridIndex];
    if (!snap) {
      setCameraError(`请先拍摄格口 ${gridIndex} 照片`);
      return;
    }
    setVisionBusy(true);
    try {
      const { image_base64, compress_size_kb } = await compressDataUrlForVision(snap);
      const vision = await analyzeVision({ image_base64, compress_size_kb });
      const kw = (vision.keywords_cn && vision.keywords_cn[0])
        || (vision.keywords_en && vision.keywords_en[0]);
      if (!kw) {
        setCameraError('未能识别菜品关键词，请手动填写');
        return;
      }
      const lib = await searchFoodLibrary(kw);
      const match = lib.matches && lib.matches[0];
      if (!match) {
        setCameraError(`食物库暂无「${kw}」匹配，请手动填写或换关键词搜索`);
        return;
      }
      updateGridInput(gridIndex, 'food_name', match.food_name_cn);
      updateGridInput(gridIndex, 'unit_cal_per_100g', String(match.default_unit_cal_per_100g));
      updateGridInput(gridIndex, 'food_code', match.food_code);
      setSubmitResult(`格口 ${gridIndex} 已匹配：${match.food_name_cn}（${match.food_code}）`);
    } catch (e) {
      setError(e.message || '识菜失败');
    } finally {
      setVisionBusy(false);
    }
  };

  /**
   * §9.3 视觉确认挂载（仅 food_code）。
   * @returns {Promise<void>}
   */
  const submitVisionConfirm = async () => {
    setSubmitResult('');
    setError(null);
    const mealId = resolveTargetMealId();
    if (!mealId) {
      setError('请先选择要挂载食物信息的餐次（当前餐次需至少有一条就餐记录）');
      return;
    }
    const visionGrids = gridInputs
      .filter((g) => String(g.food_code).trim() !== '')
      .map((g) => ({
        grid_index: g.grid_index,
        food_code: String(g.food_code).trim(),
      }));
    if (visionGrids.length === 0) {
      setError('请至少一个格口完成识菜并产生食物编码，或使用下方「手动卡路里点火」');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await confirmMealVision(mealId, visionGrids);
      setSubmitResult(res.message || '视觉识别确认成功，卡路里已就绪');
      await load();
    } catch (e) {
      setError(e.message || '视觉确认失败');
    } finally {
      setSubmitLoading(false);
    }
  };

  /**
   * §4.1 手动挂载：食物名 + 每 100g 卡路里（不向接口发送 photo / food_code）。
   * @returns {Promise<void>}
   */
  const submitManualFoods = async () => {
    setSubmitResult('');
    setError(null);
    const selected = gridInputs
      .filter((grid) => grid.food_name.trim() !== '' && grid.unit_cal_per_100g !== '')
      .map((grid) => ({
        grid_index: grid.grid_index,
        food_name: grid.food_name.trim(),
        unit_cal_per_100g: Number(grid.unit_cal_per_100g),
      }));

    const mealId = resolveTargetMealId();
    if (!mealId) {
      setError('请先选择要挂载食物信息的餐次（当前餐次需至少有一条就餐记录）');
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
      const res = await updateMealFoods(mealId, selected);
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
            流程对齐 API v4.4：按格口拍照后可点「AI 识菜」走 9.1 -> 9.2 回填食物库编码，再点「视觉确认挂载」调用 9.3；或直接手填名称与热量，使用「手动卡路里点火」调用 4.1。
          </Typography>

          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="目标餐次"
              value={selectedMealId}
              onChange={(e) => setSelectedMealId(e.target.value)}
              helperText="「当前餐次」= 列表中开餐时间最新的一餐（与下方记录顺序一致）；其余为指定 meal_id"
            >
              <MenuItem value={TARGET_MEAL_CURRENT} disabled={items.length === 0}>
                当前餐次{items[0] ? `（${formatDate(items[0].start_time)}）` : '（暂无记录）'}
              </MenuItem>
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
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={activeCaptureGrid === gridIndex ? 'contained' : 'outlined'}
                          onClick={() => setActiveCaptureGrid(gridIndex)}
                        >
                          设为当前拍照格口
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<AiVisionIcon />}
                          disabled={visionBusy || submitLoading || !gridSnapshots[gridIndex]}
                          onClick={() => recognizeGrid(gridIndex)}
                        >
                          AI 识菜
                        </Button>
                      </Stack>
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
                        <TextField
                          size="small"
                          label="食物库编码 (food_code)"
                          value={grid.food_code}
                          onChange={(e) => updateGridInput(grid.grid_index, 'food_code', e.target.value)}
                          placeholder="识菜后自动填入，9.3 必填"
                          helperText="用于 POST /meals/{meal_id}/vision-confirm"
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
                color="secondary"
                startIcon={<AiVisionIcon />}
                onClick={submitVisionConfirm}
                disabled={submitLoading || visionBusy}
              >
                {submitLoading ? '提交中...' : '视觉确认挂载 (9.3)'}
              </Button>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={submitManualFoods}
                disabled={submitLoading || visionBusy}
              >
                {submitLoading ? '提交中...' : '手动卡路里点火 (4.1)'}
              </Button>
              <Button
                variant="text"
                disabled={visionBusy}
                onClick={() => {
                  setGridInputs([
                    { grid_index: 1, food_name: '', unit_cal_per_100g: '', food_code: '' },
                    { grid_index: 2, food_name: '', unit_cal_per_100g: '', food_code: '' },
                    { grid_index: 3, food_name: '', unit_cal_per_100g: '', food_code: '' },
                    { grid_index: 4, food_name: '', unit_cal_per_100g: '', food_code: '' },
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
          <Typography variant="body1" sx={{ color: '#64748B' }}>
            回顾您的每一次健康饮食；点击记录卡片可查看各餐格详细数据
          </Typography>
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
              <Card
                sx={{
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' },
                }}
              >
                <CardActionArea
                  component="div"
                  onClick={() => openMealDetail(m.meal_id)}
                  aria-label={`查看 ${formatDate(m.start_time)} 用餐详情`}
                >
                  <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Avatar
                        sx={{
                          width: 56,
                          height: 56,
                          bgcolor: 'rgba(16, 185, 129, 0.1)',
                          color: '#10B981',
                          display: { xs: 'none', sm: 'flex' },
                        }}
                      >
                        <MealIcon fontSize="medium" />
                      </Avatar>

                      <Box sx={{ flex: 1, textAlign: 'left' }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1, flexWrap: 'wrap', gap: 1 }}>
                          <Typography variant="h6" sx={{ fontWeight: 700, color: '#1E293B', display: 'flex', alignItems: 'center', gap: 1 }}>
                            {formatDate(m.start_time)}
                          </Typography>
                          <Typography variant="caption" sx={{ color: '#94A3B8', fontFamily: 'monospace' }}>
                            ID: {m.meal_id}
                          </Typography>
                        </Box>

                        <Divider sx={{ my: 1.5 }} />

                        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
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
                                border: 'none',
                              }}
                            />
                          )}
                        </Box>

                        <Typography variant="caption" sx={{ display: 'block', mt: 1.5, color: 'primary.main', fontWeight: 600 }}>
                          点击查看餐格详情 →
                        </Typography>
                      </Box>
                    </Box>
                  </CardContent>
                </CardActionArea>
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

      <Dialog
        open={detailOpen}
        onClose={closeMealDetail}
        maxWidth="md"
        fullWidth
        scroll="paper"
        PaperProps={{ sx: { borderRadius: '20px' } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, pr: 1 }}>
          <Box>
            <Typography component="span" variant="h6" sx={{ fontWeight: 800, color: '#1E293B' }}>
              用餐详情
            </Typography>
            {detailMeal?.meal_id && (
              <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontFamily: 'monospace', mt: 0.5 }}>
                {detailMeal.meal_id}
              </Typography>
            )}
          </Box>
          <IconButton aria-label="关闭" onClick={closeMealDetail} size="small" sx={{ color: '#64748B' }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {detailLoading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
              <CircularProgress sx={{ color: '#00BFA5' }} />
            </Box>
          )}
          {!detailLoading && detailError && (
            <Alert severity="error" sx={{ borderRadius: '12px' }}>{detailError}</Alert>
          )}
          {!detailLoading && !detailError && detailMeal && (
            <Stack spacing={2}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {detailMeal.start_time && (
                  <Chip
                    size="small"
                    icon={<TimeIcon />}
                    label={formatDate(detailMeal.start_time)}
                    variant="outlined"
                    sx={{ borderColor: '#E2E8F0' }}
                  />
                )}
                {detailMeal.duration_minutes != null && (
                  <Chip
                    size="small"
                    icon={<TimerIcon />}
                    label={`时长 ${detailMeal.duration_minutes} 分钟`}
                    variant="outlined"
                    sx={{ borderColor: '#E2E8F0' }}
                  />
                )}
                {detailMeal.total_meal_cal != null && detailMeal.total_meal_cal > 0 && (
                  <Chip
                    size="small"
                    icon={<CalorieIcon />}
                    label={`合计 ${Number(detailMeal.total_meal_cal).toFixed(0)} kcal`}
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', border: 'none' }}
                  />
                )}
              </Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                各餐格数据（grid_details）
              </Typography>

              {(!detailMeal.grid_details || detailMeal.grid_details.length === 0) ? (
                <Alert severity="info" sx={{ borderRadius: '12px' }}>
                  暂无餐格明细，请确认已完成食物挂载或遥测同步。
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', borderColor: '#E2E8F0' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 700 }}>餐格</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>食物</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>打饭 (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>摄入 (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>剩余 (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>热量 (kcal)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>速度 (g/min)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {[...(detailMeal.grid_details || [])]
                        .sort((a, b) => (a.grid_index || 0) - (b.grid_index || 0))
                        .map((row) => (
                          <TableRow key={row.grid_index} hover>
                            <TableCell>{row.grid_index ?? '—'}</TableCell>
                            <TableCell sx={{ fontWeight: 600, color: '#1E293B' }}>
                              {row.food_name?.trim() ? row.food_name : '—'}
                            </TableCell>
                            <TableCell align="right">{row.served_g ?? '—'}</TableCell>
                            <TableCell align="right">{row.intake_g ?? '—'}</TableCell>
                            <TableCell align="right">
                              {row.leftover_g != null ? row.leftover_g : '—'}
                            </TableCell>
                            <TableCell align="right">
                              {row.total_cal != null ? Number(row.total_cal).toFixed(1) : '—'}
                            </TableCell>
                            <TableCell align="right">
                              {row.speed_g_per_min != null ? Number(row.speed_g_per_min).toFixed(1) : '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeMealDetail} variant="contained" sx={{ textTransform: 'none', fontWeight: 600 }}>
            关闭
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

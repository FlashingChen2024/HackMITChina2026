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

/** Value for "Current Meal" selector option (not a real meal_id; must resolve before submit). */
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

  /** Meal detail dialog (§4.3 GET /meals/{meal_id}) */
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
      setCameraError('Camera is connected, but autoplay failed. Please try opening the camera again.');
    });
  }, [cameraOpen]);

  const formatDate = (isoString) => {
    if (!isoString) return 'Unknown time';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(date);
  };

  /**
   * Open §4.3 meal details (GET /meals/{meal_id}) and render grid_details.
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
      setDetailError(e?.message || 'Failed to load meal details.');
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
   * Resolve selected target meal value into actual API meal_id.
   * For "Current Meal", use the first list item (latest meal).
   * @returns {string}
   */
  const resolveTargetMealId = () => {
    if (selectedMealId === TARGET_MEAL_CURRENT) {
      return items[0]?.meal_id ?? '';
    }
    return selectedMealId;
  };

  /**
   * Open camera stream and render into video component.
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
      setCameraError(e.message || 'Unable to access camera.');
    }
  };

  /**
   * Stop camera capture and release media tracks.
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
   * Capture current video frame as base64 for user confirmation.
   * @returns {void}
   */
  const captureSnapshot = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    if (video.readyState < 2 || !cameraReady) {
      setCameraError('Camera is still initializing. Please wait for the preview before taking a photo.');
      return;
    }
    const canvas = canvasRef.current;
    if (!video.videoWidth || !video.videoHeight) {
      setCameraError('Camera preview is unavailable. Reopen camera and try again.');
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
   * Update a grid slot's food name, calories, or food library code.
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
   * Single slot flow: compress image -> §9.1 recognition -> §9.2 food library.
   * @param {number} gridIndex
   * @returns {Promise<void>}
   */
  const recognizeGrid = async (gridIndex) => {
    setCameraError('');
    setSubmitResult('');
    setError(null);
    const snap = gridSnapshots[gridIndex];
    if (!snap) {
      setCameraError(`Please take a photo for grid ${gridIndex} first.`);
      return;
    }
    setVisionBusy(true);
    try {
      const { image_base64, compress_size_kb } = await compressDataUrlForVision(snap);
      const vision = await analyzeVision({ image_base64, compress_size_kb });
      const kw = (vision.keywords_cn && vision.keywords_cn[0])
        || (vision.keywords_en && vision.keywords_en[0]);
      if (!kw) {
        setCameraError('No food keyword recognized. Please fill it manually.');
        return;
      }
      const lib = await searchFoodLibrary(kw);
      const match = lib.matches && lib.matches[0];
      if (!match) {
        setCameraError(`No food library match for "${kw}". Please fill manually or try another keyword.`);
        return;
      }
      updateGridInput(gridIndex, 'food_name', match.food_name_cn);
      updateGridInput(gridIndex, 'unit_cal_per_100g', String(match.default_unit_cal_per_100g));
      updateGridInput(gridIndex, 'food_code', match.food_code);
      setSubmitResult(`Grid ${gridIndex} matched: ${match.food_name_cn} (${match.food_code})`);
    } catch (e) {
      setError(e.message || 'Food recognition failed.');
    } finally {
      setVisionBusy(false);
    }
  };

  /**
   * §9.3 visual confirmation attach (food_code only).
   * @returns {Promise<void>}
   */
  const submitVisionConfirm = async () => {
    setSubmitResult('');
    setError(null);
    const mealId = resolveTargetMealId();
    if (!mealId) {
      setError('Please select a meal to attach food info (Current Meal requires at least one meal record).');
      return;
    }
    const visionGrids = gridInputs
      .filter((g) => String(g.food_code).trim() !== '')
      .map((g) => ({
        grid_index: g.grid_index,
        food_code: String(g.food_code).trim(),
      }));
    if (visionGrids.length === 0) {
      setError('Please complete recognition for at least one grid and get a food code, or use "Manual Calorie Attach" below.');
      return;
    }
    setSubmitLoading(true);
    try {
      const res = await confirmMealVision(mealId, visionGrids);
      setSubmitResult(res.message || 'Visual confirmation succeeded. Calories are ready.');
      await load();
    } catch (e) {
      setError(e.message || 'Visual confirmation failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  /**
   * §4.1 manual attach: food name + calories per 100g (without photo/food_code).
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
      setError('Please select a meal to attach food info (Current Meal requires at least one meal record).');
      return;
    }
    if (selected.length === 0) {
      setError('Please fill at least one grid with food name and calories per 100g.');
      return;
    }
    if (selected.some((item) => Number.isNaN(item.unit_cal_per_100g) || item.unit_cal_per_100g < 0)) {
      setError('Calories per 100g must be a number greater than or equal to 0.');
      return;
    }

    setSubmitLoading(true);
    try {
      const res = await updateMealFoods(mealId, selected);
      setSubmitResult(res.message || 'Food info attached successfully. Calories are ready.');
      await load();
    } catch (e) {
      setError(e.message || 'Submit failed.');
    } finally {
      setSubmitLoading(false);
    }
  };

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 1, fontWeight: 700 }}>
            Food Visual Recognition and Calorie Calculation
          </Typography>
          <Typography variant="body2" sx={{ mb: 2, color: '#64748B' }}>
            
          </Typography>

          <Stack spacing={2}>
            <TextField
              select
              size="small"
              label="Target Meal"
              value={selectedMealId}
              onChange={(e) => setSelectedMealId(e.target.value)}
              helperText='"Current Meal" = latest meal by start time in the list below; others are specific meal_id values.'
            >
              <MenuItem value={TARGET_MEAL_CURRENT} disabled={items.length === 0}>
                Current Meal{items[0] ? ` (${formatDate(items[0].start_time)})` : ' (No records)'}
              </MenuItem>
              {mealOptions.map((option) => (
                <MenuItem key={option.mealId} value={option.mealId}>{option.label}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              size="small"
              label="Active Capture Grid"
              value={activeCaptureGrid}
              onChange={(e) => setActiveCaptureGrid(Number(e.target.value))}
              helperText="Recommended order: capture Grid 1 to 4 sequentially."
            >
              <MenuItem value={1}>Grid 1</MenuItem>
              <MenuItem value={2}>Grid 2</MenuItem>
              <MenuItem value={3}>Grid 3</MenuItem>
              <MenuItem value={4}>Grid 4</MenuItem>
            </TextField>

            <TextField
              select
              size="small"
              label="Capture Mode"
              value={autoAdvanceCapture ? 'auto' : 'manual'}
              onChange={(e) => setAutoAdvanceCapture(e.target.value === 'auto')}
              helperText="Burst mode auto-switches to the next grid after each shot."
            >
              <MenuItem value="auto">Burst Mode (auto switch)</MenuItem>
              <MenuItem value="manual">Manual Mode (no auto switch)</MenuItem>
            </TextField>

            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {!cameraOpen ? (
                <Button variant="contained" startIcon={<CameraIcon />} onClick={startCamera}>
                  Open Camera
                </Button>
              ) : (
                <Button variant="outlined" color="error" startIcon={<StopCameraIcon />} onClick={stopCamera}>
                  Close Camera
                </Button>
              )}
              <Button variant="outlined" onClick={captureSnapshot} disabled={!cameraOpen || !cameraReady}>
                Capture Grid {activeCaptureGrid}
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
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Grid {gridIndex} Photo</Typography>
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
                          Not captured
                        </Box>
                      )}
                      <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ gap: 1 }}>
                        <Button
                          size="small"
                          variant={activeCaptureGrid === gridIndex ? 'contained' : 'outlined'}
                          onClick={() => setActiveCaptureGrid(gridIndex)}
                        >
                          Set as Active Grid
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          color="secondary"
                          startIcon={<AiVisionIcon />}
                          disabled={visionBusy || submitLoading || !gridSnapshots[gridIndex]}
                          onClick={() => recognizeGrid(gridIndex)}
                        >
                          AI Recognize
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
                      <Typography variant="subtitle2" sx={{ mb: 1 }}>Grid {grid.grid_index}</Typography>
                      <Stack spacing={1.5}>
                        <TextField
                          size="small"
                          label="Food Name"
                          value={grid.food_name}
                          onChange={(e) => updateGridInput(grid.grid_index, 'food_name', e.target.value)}
                          placeholder="e.g. Scrambled Eggs with Tomato"
                        />
                        <TextField
                          size="small"
                          type="number"
                          label="Calories per 100g"
                          value={grid.unit_cal_per_100g}
                          onChange={(e) => updateGridInput(grid.grid_index, 'unit_cal_per_100g', e.target.value)}
                          inputProps={{ min: 0, step: '0.1' }}
                          placeholder="e.g. 80"
                        />
                        <TextField
                          size="small"
                          label="Food Library Code (food_code)"
                          value={grid.food_code}
                          onChange={(e) => updateGridInput(grid.grid_index, 'food_code', e.target.value)}
                          placeholder="Auto-filled after recognition, required for 9.3"
                          helperText="Used by POST /meals/{meal_id}/vision-confirm"
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
                {submitLoading ? 'Submitting...' : 'Food nutrition recognition by AI'}
              </Button>
              <Button
                variant="contained"
                startIcon={<SendIcon />}
                onClick={submitManualFoods}
                disabled={submitLoading || visionBusy}
              >
                {submitLoading ? 'Submitting...' : 'Food nutrition recognition by hand'}
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
                Clear Inputs
              </Button>
            </Box>

            {cameraError && <Alert severity="error">{cameraError}</Alert>}
            {submitResult && <Alert severity="success">{submitResult}</Alert>}
          </Stack>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, mb: 4, gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>Meal Records</Typography>
          <Typography variant="body1" sx={{ color: '#64748B' }}>
            Review each healthy meal. Click a record card to view grid-level details.
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
          <Tooltip title="Refresh Records">
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
                  aria-label={`View meal details for ${formatDate(m.start_time)}`}
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
                            label={new Date(m.start_time).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                            variant="outlined"
                            sx={{ borderColor: '#E2E8F0', color: '#64748B' }}
                          />
                          {m.duration_minutes != null && (
                            <Chip
                              icon={<TimerIcon fontSize="small" />}
                              label={`${m.duration_minutes} min`}
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
                            Click to view grid details
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
                {loading ? <CircularProgress size={24} color="inherit" /> : 'Load More Records'}
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
            <Typography variant="h6" sx={{ color: '#475569', mb: 1 }}>No meal records yet</Typography>
            <Typography variant="body2" sx={{ color: '#94A3B8', maxWidth: 400, mx: 'auto' }}>
              Please bind a device and upload telemetry data, or import test data to view records.
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
              Meal Details
            </Typography>
            {detailMeal?.meal_id && (
              <Typography variant="caption" sx={{ display: 'block', color: '#64748B', fontFamily: 'monospace', mt: 0.5 }}>
                {detailMeal.meal_id}
              </Typography>
            )}
          </Box>
          <IconButton aria-label="Close" onClick={closeMealDetail} size="small" sx={{ color: '#64748B' }}>
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
                    label={`Duration ${detailMeal.duration_minutes} min`}
                    variant="outlined"
                    sx={{ borderColor: '#E2E8F0' }}
                  />
                )}
                {detailMeal.total_meal_cal != null && detailMeal.total_meal_cal > 0 && (
                  <Chip
                    size="small"
                    icon={<CalorieIcon />}
                    label={`Total ${Number(detailMeal.total_meal_cal).toFixed(0)} kcal`}
                    sx={{ bgcolor: 'rgba(239, 68, 68, 0.08)', color: '#EF4444', border: 'none' }}
                  />
                )}
              </Box>

              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#1E293B' }}>
                Grid Details (grid_details)
              </Typography>

              {(!detailMeal.grid_details || detailMeal.grid_details.length === 0) ? (
                <Alert severity="info" sx={{ borderRadius: '12px' }}>
                  No grid details yet. Please confirm food attach or telemetry sync is complete.
                </Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: '12px', borderColor: '#E2E8F0' }}>
                  <Table size="small" stickyHeader>
                    <TableHead>
                      <TableRow sx={{ bgcolor: '#F8FAFC' }}>
                        <TableCell sx={{ fontWeight: 700 }}>Grid</TableCell>
                        <TableCell sx={{ fontWeight: 700 }}>Food</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Served (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Intake (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Leftover (g)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Calories (kcal)</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 700 }}>Speed (g/min)</TableCell>
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
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

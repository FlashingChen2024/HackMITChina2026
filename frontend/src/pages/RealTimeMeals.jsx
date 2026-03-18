import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Container,
  Card,
  CardContent,
  Typography,
  Button,
  Alert,
  CircularProgress,
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import { PlayArrow as PlayIcon, Stop as StopIcon } from '@mui/icons-material';
import { fetchMeals, fetchMealTrajectory } from '../api/meals';
import ChartBlock from '../components/ChartBlock';

export default function RealTimeMeals() {
  const [meals, setMeals] = useState([]);
  const [selectedMealId, setSelectedMealId] = useState('');
  const [sampleInterval, setSampleInterval] = useState(1); // 默认1秒
  const [updateInterval, setUpdateInterval] = useState(5); // 默认5秒
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [trajectoryData, setTrajectoryData] = useState([]);
  const intervalRef = useRef(null);
  const lastTimestampRef = useRef(null);

  // 加载用餐列表
  useEffect(() => {
    const loadMeals = async () => {
      try {
        const res = await fetchMeals({ limit: 50 });
        setMeals(res.items || []);
      } catch (e) {
        setError('加载用餐列表失败: ' + e.message);
      }
    };
    loadMeals();
  }, []);

  // 停止实时更新
  const stopRealTime = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  };

  // 获取数据的函数
  const fetchData = useCallback(async () => {
    try {
      const res = await fetchMealTrajectory(selectedMealId, {
        lastTimestamp: lastTimestampRef.current,
        sampleInterval,
      });
      if (res.items && res.items.length > 0) {
        setTrajectoryData(prev => [...prev, ...res.items]);
        lastTimestampRef.current = res.last_timestamp;
      }
    } catch (e) {
      setError('获取轨迹数据失败: ' + e.message);
      stopRealTime();
    }
  }, [selectedMealId, sampleInterval]);

  // 开始实时更新
  const startRealTime = () => {
    if (!selectedMealId) {
      setError('请选择一个用餐记录');
      return;
    }
    setError(null);
    setTrajectoryData([]);
    lastTimestampRef.current = null;
    setIsRunning(true);

    // 立即获取一次
    fetchData();

    // 根据设置的间隔更新
    intervalRef.current = setInterval(fetchData, updateInterval * 1000);
  };

  // 监听更新间隔变化，如果正在运行则重新设置定时器
  useEffect(() => {
    if (isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      intervalRef.current = setInterval(fetchData, updateInterval * 1000);
    }
  }, [updateInterval, fetchData, isRunning]);

  // 准备图表数据
  const chartOption = {
    title: {
      text: '用餐重量轨迹',
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['grid_1', 'grid_2', 'grid_3', 'grid_4'],
    },
    xAxis: {
      type: 'time',
      name: '时间',
    },
    yAxis: {
      type: 'value',
      name: '重量 (g)',
    },
    series: [
      {
        name: 'grid_1',
        type: 'line',
        data: trajectoryData.map(item => [new Date(item.timestamp), item.weights.grid_1]),
      },
      {
        name: 'grid_2',
        type: 'line',
        data: trajectoryData.map(item => [new Date(item.timestamp), item.weights.grid_2]),
      },
      {
        name: 'grid_3',
        type: 'line',
        data: trajectoryData.map(item => [new Date(item.timestamp), item.weights.grid_3]),
      },
      {
        name: 'grid_4',
        type: 'line',
        data: trajectoryData.map(item => [new Date(item.timestamp), item.weights.grid_4]),
      },
    ],
  };

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        实时用餐数据查看
      </Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            选择用餐记录
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'center' }}>
            <FormControl fullWidth>
              <InputLabel>用餐记录</InputLabel>
              <Select
                value={selectedMealId}
                onChange={(e) => setSelectedMealId(e.target.value)}
                label="用餐记录"
              >
                {meals.map((meal) => (
                  <MenuItem key={meal.meal_id} value={meal.meal_id}>
                    {meal.meal_id} - {new Date(meal.start_time).toLocaleString()}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="降采样间隔 (秒)"
              type="number"
              value={sampleInterval}
              onChange={(e) => setSampleInterval(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 150 }}
            />
            <TextField
              label="更新间隔 (秒)"
              type="number"
              value={updateInterval}
              onChange={(e) => setUpdateInterval(Number(e.target.value))}
              inputProps={{ min: 1 }}
              sx={{ width: 150 }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Button
              variant="contained"
              startIcon={<PlayIcon />}
              onClick={startRealTime}
              disabled={isRunning || !selectedMealId}
            >
              开始实时查看
            </Button>
            <Button
              variant="outlined"
              startIcon={<StopIcon />}
              onClick={stopRealTime}
              disabled={!isRunning}
            >
              停止
            </Button>
          </Box>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {trajectoryData.length > 0 && (
        <Card>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              重量变化轨迹
            </Typography>
            <ChartBlock option={chartOption} height="500px" />
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              数据点数量: {trajectoryData.length} | 最后更新: {lastTimestampRef.current ? new Date(lastTimestampRef.current).toLocaleString() : '无'}
            </Typography>
          </CardContent>
        </Card>
      )}

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
    </Container>
  );
}
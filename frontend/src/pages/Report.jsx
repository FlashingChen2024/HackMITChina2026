import { useState } from 'react';
import {
  Container,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Grid,
} from '@mui/material';
import { Refresh as RefreshIcon, AutoAwesome as GenerateIcon } from '@mui/icons-material';
import { getCurrentUser } from '../api/client';
import { generateReport, getReport } from '../api/report';

export default function Report() {
  const currentUser = getCurrentUser();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [reportType, setReportType] = useState('daily');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await generateReport({
        date,
        report_type: reportType,
        force_fallback: false
      });
      setData(res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGet = async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await getReport(date, reportType);
      setData(res.data?.analysis_result || res.data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ py: 2 }}>
        <Card sx={{ mb: 3 }}>
          <CardContent>
            <Typography variant="h5" sx={{ fontWeight: 'bold', mb: 3 }}>
              📄 AI 报告
            </Typography>

            {currentUser && (
              <Alert severity="info" sx={{ mb: 3 }}>
                当前用户：<strong>{currentUser.username}</strong>（ID: {currentUser.userId}）
              </Alert>
            )}

            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  type="date"
                  label="日期"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  InputLabelProps={{ shrink: true }}
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  fullWidth
                  select
                  label="报告类型"
                  value={reportType}
                  onChange={(e) => setReportType(e.target.value)}
                  SelectProps={{
                    native: true,
                  }}
                >
                  <option value="daily">日报</option>
                  <option value="weekly">周报</option>
                </TextField>
              </Grid>
            </Grid>

            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                startIcon={<GenerateIcon />}
                onClick={handleGenerate}
                disabled={loading}
              >
                生成报告
              </Button>
              <Button
                variant="outlined"
                startIcon={<RefreshIcon />}
                onClick={handleGet}
                disabled={loading}
              >
                查询已有
              </Button>
            </Box>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
          </CardContent>
        </Card>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress />
          </Box>
        ) : data ? (
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 2 }}>
                报告内容
              </Typography>

              {typeof data === 'string' && (
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {data}
                  </Typography>
                </Paper>
              )}

              {data.analysis_result && typeof data.analysis_result === 'string' && (
                <Paper
                  sx={{
                    p: 2,
                    backgroundColor: '#f5f5f5',
                    fontFamily: 'monospace',
                    overflow: 'auto',
                    mb: 2,
                  }}
                >
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
                    {data.analysis_result}
                  </Typography>
                </Paper>
              )}

              {data.diet_evaluation && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      💭 评价
                    </Typography>
                    <Typography variant="body2" color="textSecondary">
                      {data.diet_evaluation}
                    </Typography>
                  </Box>
                </>
              )}

              {data.improvement_measures?.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      ✅ 改进措施
                    </Typography>
                    <List dense>
                      {data.improvement_measures.map((m, i) => (
                        <ListItem key={i} sx={{ py: 0.5 }}>
                          <ListItemText primary={m} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </>
              )}

              {data.next_week_goals?.length > 0 && (
                <>
                  <Divider sx={{ my: 2 }} />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 'bold', mb: 1 }}>
                      🎯 下周目标
                    </Typography>
                    <List dense>
                      {data.next_week_goals.map((g, i) => (
                        <ListItem key={i} sx={{ py: 0.5 }}>
                          <ListItemText primary={g} />
                        </ListItem>
                      ))}
                    </List>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        ) : null}
      </Box>
    </Container>
  );
}

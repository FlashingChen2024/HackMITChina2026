import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  TextField,
  Button,
  Alert,
  CircularProgress,
  Stack,
  MenuItem,
  Grid,
  Chip,
  Divider,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Save as SaveIcon,
  Refresh as RefreshIcon,
  MonitorHeart as HealthIcon,
  Notifications as AlertIcon,
} from '@mui/icons-material';
import { fetchProfile, updateProfile, normalizeProfilePayload, fetchAlertSetting, updateAlertSetting } from '../api/profile';
import { getCurrentUser } from '../api/client';

const GENDER_OPTIONS = [
  { value: 'male', label: '男' },
  { value: 'female', label: '女' },
  { value: 'other', label: '其他' },
];

const EMPTY_FORM = {
  gender: 'male',
  age: '',
  height_cm: '',
  weight_kg: '',
};

/**
 * 合并两次接口结果：新响应里缺字段时保留上一次档案（避免 GET 空壳覆盖保存后的乐观更新）。
 *
 * @param {Record<string, unknown> | null} prev
 * @param {ReturnType<typeof normalizeProfilePayload>} n
 * @param {string | undefined} uid
 * @returns {{ user_id: string, gender?: string, age: number | null, height_cm: number | null, weight_kg: number | null, updated_at?: string } | null}
 */
function mergeProfileState(prev, n, uid) {
  const base = prev && prev.user_id
    ? prev
    : null;
  if (!base) {
    const user_id = String(n.user_id || uid || '');
    if (!user_id) return null;
    return {
      user_id,
      gender: typeof n.gender === 'string' && n.gender ? n.gender : undefined,
      age: n.age != null && !Number.isNaN(n.age) ? n.age : null,
      height_cm: n.height_cm != null && !Number.isNaN(n.height_cm) ? n.height_cm : null,
      weight_kg: n.weight_kg != null && !Number.isNaN(n.weight_kg) ? n.weight_kg : null,
      ...(n.updated_at ? { updated_at: n.updated_at } : {}),
    };
  }
  return {
    user_id: String(n.user_id || base.user_id || uid || ''),
    gender: (typeof n.gender === 'string' && n.gender) ? n.gender : base.gender,
    age: (n.age != null && !Number.isNaN(n.age)) ? n.age : (base.age ?? null),
    height_cm: (n.height_cm != null && !Number.isNaN(n.height_cm)) ? n.height_cm : (base.height_cm ?? null),
    weight_kg: (n.weight_kg != null && !Number.isNaN(n.weight_kg)) ? n.weight_kg : (base.weight_kg ?? null),
    updated_at: n.updated_at || base.updated_at,
  };
}

/**
 * 使用 Mifflin-St Jeor 公式估算基础代谢率（kcal/天），仅作前端展示参考。
 *
 * @param {{ gender: string, age: number, height_cm: number, weight_kg: number }} p
 * @returns {number | null}
 */
function estimateBmr(p) {
  const { gender, age, height_cm, weight_kg } = p;
  if (
    age == null || Number.isNaN(age) || age <= 0
    || height_cm == null || Number.isNaN(height_cm) || height_cm <= 0
    || weight_kg == null || Number.isNaN(weight_kg) || weight_kg <= 0
  ) {
    return null;
  }
  const base = 10 * weight_kg + 6.25 * height_cm - 5 * age;
  if (gender === 'female') return Math.round(base - 161);
  if (gender === 'male') return Math.round(base + 5);
  return Math.round(base - 78);
}

/**
 * 判断是否为「画像不存在」类错误（404 或业务码）。
 *
 * @param {unknown} err
 * @returns {boolean}
 */
function isProfileNotFoundError(err) {
  if (!(err instanceof Error)) return false;
  const m = err.message || '';
  return m.includes('404')
    || m.includes('profile_not_found')
    || m.includes('尚未填写');
}

export default function Profile() {
  const currentUser = getCurrentUser();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveOk, setSaveOk] = useState('');
  const [serverProfile, setServerProfile] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertSaving, setAlertSaving] = useState(false);
  const [alertError, setAlertError] = useState('');
  const [alertOk, setAlertOk] = useState('');
  const [alertForm, setAlertForm] = useState({ email: '', enabled: false });

  /**
   * 将接口数据写入 `serverProfile`；`merge=true` 时与当前状态合并，避免空 GET 冲掉已保存数据。
   *
   * @param {Record<string, unknown>} data
   * @param {{ merge?: boolean }} [options]
   * @returns {void}
   */
  const applyServerProfileData = useCallback((data, options = {}) => {
    const { merge = false } = options;
    const n = normalizeProfilePayload(data);
    const me = getCurrentUser();
    const uid = me?.userId ?? me?.user_id;

    setServerProfile((prev) => {
      if (merge) {
        const merged = mergeProfileState(prev, n, uid);
        return merged;
      }
      const user_id = String(n.user_id || uid || '');
      if (!user_id) return null;
      return {
        user_id,
        gender: typeof n.gender === 'string' && n.gender ? n.gender : undefined,
        age: n.age != null && !Number.isNaN(n.age) ? n.age : null,
        height_cm: n.height_cm != null && !Number.isNaN(n.height_cm) ? n.height_cm : null,
        weight_kg: n.weight_kg != null && !Number.isNaN(n.weight_kg) ? n.weight_kg : null,
        ...(n.updated_at ? { updated_at: n.updated_at } : {}),
      };
    });
  }, []);

  /** 左侧档案为单一数据源，右侧表单与其同步（用户正在编辑时不会反复覆盖，仅随 serverProfile 引用变化更新）。 */
  useEffect(() => {
    if (!serverProfile?.user_id) {
      setForm({ ...EMPTY_FORM });
      return;
    }
    setForm({
      gender: serverProfile.gender && ['male', 'female', 'other'].includes(serverProfile.gender)
        ? serverProfile.gender
        : 'male',
      age: serverProfile.age != null && !Number.isNaN(serverProfile.age) ? String(serverProfile.age) : '',
      height_cm: serverProfile.height_cm != null && !Number.isNaN(serverProfile.height_cm)
        ? String(serverProfile.height_cm)
        : '',
      weight_kg: serverProfile.weight_kg != null && !Number.isNaN(serverProfile.weight_kg)
        ? String(serverProfile.weight_kg)
        : '',
    });
  }, [serverProfile]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const data = await fetchProfile();
      applyServerProfileData(data);
    } catch (e) {
      if (isProfileNotFoundError(e)) {
        const uid = getCurrentUser()?.userId ?? getCurrentUser()?.user_id;
        if (uid) {
          setServerProfile({
            user_id: String(uid),
            gender: undefined,
            age: null,
            height_cm: null,
            weight_kg: null,
          });
        } else {
          setServerProfile(null);
        }
      } else {
        setLoadError(e instanceof Error ? e.message : '加载失败');
      }
    } finally {
      setLoading(false);
    }
  }, [applyServerProfileData]);

  useEffect(() => {
    load();
  }, [load]);

  const loadAlertSetting = useCallback(async () => {
    setAlertLoading(true);
    setAlertError('');
    try {
      const data = await fetchAlertSetting();
      setAlertForm({
        email: data.email || '',
        enabled: data.enabled || false,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes('404')) {
        setAlertForm({ email: '', enabled: false });
      } else {
        setAlertError(e instanceof Error ? e.message : '加载告警设置失败');
      }
    } finally {
      setAlertLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAlertSetting();
  }, [loadAlertSetting]);

  const handleAlertSave = async () => {
    setAlertError('');
    setAlertOk('');
    if (alertForm.enabled && !alertForm.email.trim()) {
      setAlertError('启用告警时必须填写邮箱地址');
      return;
    }
    setAlertSaving(true);
    try {
      await updateAlertSetting({
        email: alertForm.email.trim(),
        enabled: alertForm.enabled,
      });
      setAlertOk('告警设置保存成功');
    } catch (e) {
      setAlertError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setAlertSaving(false);
    }
  };

  const bmrPreview = useMemo(() => {
    const age = parseInt(form.age, 10);
    const height_cm = parseFloat(form.height_cm);
    const weight_kg = parseFloat(form.weight_kg);
    return estimateBmr({
      gender: form.gender,
      age,
      height_cm,
      weight_kg,
    });
  }, [form]);

  /**
   * @returns {Promise<void>}
   */
  const handleSave = async () => {
    setSaveError('');
    setSaveOk('');
    const age = parseInt(form.age, 10);
    const height_cm = parseFloat(form.height_cm);
    const weight_kg = parseFloat(form.weight_kg);
    if (!['male', 'female', 'other'].includes(form.gender)) {
      setSaveError('请选择性别');
      return;
    }
    if (Number.isNaN(age) || age < 1 || age > 120) {
      setSaveError('请输入有效年龄（1–120）');
      return;
    }
    if (Number.isNaN(height_cm) || height_cm < 50 || height_cm > 260) {
      setSaveError('请输入有效身高 cm（50–260）');
      return;
    }
    if (Number.isNaN(weight_kg) || weight_kg < 20 || weight_kg > 300) {
      setSaveError('请输入有效体重 kg（20–300）');
      return;
    }

    setSaving(true);
    try {
      const res = await updateProfile({
        gender: form.gender,
        age,
        height_cm,
        weight_kg,
      });
      setSaveOk(res.message || '画像保存成功');
      applyServerProfileData({
        user_id: getCurrentUser()?.userId ?? getCurrentUser()?.user_id,
        gender: form.gender,
        age,
        height_cm,
        weight_kg,
        updated_at: res.updated_at,
      }, { merge: false });
      try {
        const fresh = await fetchProfile();
        applyServerProfileData(fresh, { merge: true });
      } catch {
        /* 保留乐观更新 */
      }
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : '保存失败');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>
        <CircularProgress sx={{ color: '#00BFA5' }} />
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 4, maxWidth: 900, mx: 'auto' }}>
      <Box sx={{ mb: 3, display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 0.5 }}>
            个人信息
          </Typography>
          <Typography variant="body2" sx={{ color: '#64748B' }}>
            填写身高、体重等信息，为云端 AI 计算基础代谢与营养建议提供依据。
          </Typography>
        </Box>
        <Button startIcon={<RefreshIcon />} variant="outlined" onClick={load} disabled={saving}>
          刷新数据
        </Button>
      </Box>

      {loadError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setLoadError('')}>
          {loadError}
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError('')}>
          {saveError}
        </Alert>
      )}
      {saveOk && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveOk('')}>
          {saveOk}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                <HealthIcon color="primary" />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  当前档案
                </Typography>
              </Stack>
              <Divider sx={{ mb: 2 }} />
              {serverProfile ? (
                <Stack spacing={1.5}>
                  <Typography variant="body2" color="text.secondary">
                    用户 ID
                  </Typography>
                  <Typography variant="body1" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>
                    {serverProfile.user_id || currentUser?.userId || currentUser?.user_id || '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                    性别
                  </Typography>
                  <Chip
                    size="small"
                    label={
                      serverProfile.gender
                        ? (GENDER_OPTIONS.find((g) => g.value === serverProfile.gender)?.label
                          || serverProfile.gender)
                        : '—'
                    }
                    sx={{ alignSelf: 'flex-start' }}
                  />
                  <Typography variant="body2" color="text.secondary">年龄</Typography>
                  <Typography variant="body1">
                    {serverProfile.age != null && !Number.isNaN(serverProfile.age) ? `${serverProfile.age} 岁` : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">身高</Typography>
                  <Typography variant="body1">
                    {serverProfile.height_cm != null && !Number.isNaN(serverProfile.height_cm)
                      ? `${serverProfile.height_cm} cm`
                      : '—'}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">体重</Typography>
                  <Typography variant="body1">
                    {serverProfile.weight_kg != null && !Number.isNaN(serverProfile.weight_kg)
                      ? `${serverProfile.weight_kg} kg`
                      : '—'}
                  </Typography>
                  {serverProfile.updated_at && (
                    <>
                      <Typography variant="body2" color="text.secondary" sx={{ pt: 1 }}>
                        最近更新
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(serverProfile.updated_at).toLocaleString('zh-CN')}
                      </Typography>
                    </>
                  )}
                </Stack>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  服务端暂无画像记录，可在右侧填写后保存，将执行 Upsert 创建档案。
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={7}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 2 }}>
                编辑健康数据
              </Typography>
              <Stack spacing={2.5} component="form" noValidate onSubmit={(e) => { e.preventDefault(); handleSave(); }}>
                <TextField
                  select
                  label="性别"
                  value={form.gender}
                  onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  fullWidth
                  size="small"
                >
                  {GENDER_OPTIONS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="年龄"
                  type="number"
                  value={form.age}
                  onChange={(e) => setForm((f) => ({ ...f, age: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 1, max: 120 }}
                  placeholder="例如 22"
                />
                <TextField
                  label="身高 (cm)"
                  type="number"
                  value={form.height_cm}
                  onChange={(e) => setForm((f) => ({ ...f, height_cm: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 50, max: 260, step: 0.1 }}
                  placeholder="例如 178.5"
                />
                <TextField
                  label="体重 (kg)"
                  type="number"
                  value={form.weight_kg}
                  onChange={(e) => setForm((f) => ({ ...f, weight_kg: e.target.value }))}
                  fullWidth
                  size="small"
                  inputProps={{ min: 20, max: 300, step: 0.1 }}
                  placeholder="例如 75.0"
                />

                {bmrPreview != null && (
                  <Alert severity="info" icon={<HealthIcon />}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      参考基础代谢（估算）
                    </Typography>
                    <Typography variant="body2">
                      约 <strong>{bmrPreview}</strong> kcal/天（Mifflin-St Jeor，仅供参考，非医疗结论）
                    </Typography>
                  </Alert>
                )}

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  disabled={saving}
                  sx={{ alignSelf: 'flex-start', borderRadius: 2, px: 3 }}
                >
                  {saving ? '保存中…' : '保存信息'}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* 告警设置 */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
            <AlertIcon color="primary" />
            <Typography variant="h6" sx={{ fontWeight: 700 }}>
              告警设置
            </Typography>
          </Stack>
          <Divider sx={{ mb: 2 }} />
          {alertLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
              <CircularProgress size={24} />
            </Box>
          ) : (
            <>
              {alertError && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setAlertError('')}>
                  {alertError}
                </Alert>
              )}
              {alertOk && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setAlertOk('')}>
                  {alertOk}
                </Alert>
              )}
              <Stack spacing={2.5}>
                <TextField
                  label="告警邮箱"
                  type="email"
                  value={alertForm.email}
                  onChange={(e) => setAlertForm((f) => ({ ...f, email: e.target.value }))}
                  fullWidth
                  size="small"
                  placeholder="example@email.com"
                  helperText="接收健康告警通知的邮箱地址"
                />
                <FormControlLabel
                  control={
                    <Switch
                      checked={alertForm.enabled}
                      onChange={(e) => setAlertForm((f) => ({ ...f, enabled: e.target.checked }))}
                      color="primary"
                    />
                  }
                  label="启用邮箱告警"
                />
                <Alert severity="info" icon={<AlertIcon />}>
                  <Typography variant="body2">
                    启用后，系统将在检测到健康数据异常时发送邮件通知。
                  </Typography>
                </Alert>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={alertSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                  disabled={alertSaving}
                  sx={{ alignSelf: 'flex-start', borderRadius: 2, px: 3 }}
                  onClick={handleAlertSave}
                >
                  {alertSaving ? '保存中…' : '保存告警设置'}
                </Button>
              </Stack>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

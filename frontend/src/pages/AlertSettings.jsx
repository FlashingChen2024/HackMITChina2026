import { useState, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Checkbox,
  FormControlLabel,
  TextField,
  Stack,
  Chip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Divider,
  Avatar,
  MenuItem,
  Alert,
} from '@mui/material';
import {
  Add as AddIcon,
  Close as CloseIcon,
  NotificationsActive as AlertHeaderIcon,
  Email as ContactHeaderIcon,
  Tune as TuneIcon,
  AutoFixHigh as DefaultPresetIcon,
} from '@mui/icons-material';

/** @typedef {{ id: string, name: string, email: string }} AlertContact */

/** @typedef {'minute' | 'hour' | 'day' | 'week' | 'month'} TimeUnit */
/** @typedef {'max' | 'min' | 'range'} BoundType */

/**
 * @typedef {object} ThresholdRule
 * @property {string} intervalN 每 N 个单位时间
 * @property {TimeUnit} timeUnit
 * @property {BoundType} boundType
 * @property {string} boundValue 最大值或最小值时的单一阈值
 * @property {string} boundMin 区间下限
 * @property {string} boundMax 区间上限
 */

const CRITERIA_KEYS = [
  { key: 'duration', label: '用餐时长' },
  { key: 'speed', label: '用餐速度' },
  { key: 'remaining', label: '用餐剩余量' },
  { key: 'intake', label: '用餐摄入量' },
];

/** @type {Record<string, string>} */
const CRITERIA_LABEL_MAP = {
  duration: '用餐时长',
  speed: '用餐速度',
  remaining: '用餐剩余量',
  intake: '用餐摄入量',
  mealTime: '每餐进餐时间',
};

const ALL_ROW_KEYS = ['duration', 'speed', 'remaining', 'intake', 'mealTime'];

/** @type {{ value: TimeUnit, label: string }[]} */
const TIME_UNIT_OPTIONS = [
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
  { value: 'week', label: '周' },
  { value: 'month', label: '月' },
];

/** @type {{ value: BoundType, label: string }[]} */
const BOUND_TYPE_OPTIONS = [
  { value: 'max', label: '最大值' },
  { value: 'min', label: '最小值' },
  { value: 'range', label: '区间' },
];

/**
 * @returns {ThresholdRule}
 */
function emptyThresholdRule() {
  return {
    intervalN: '',
    timeUnit: 'day',
    boundType: 'max',
    boundValue: '',
    boundMin: '',
    boundMax: '',
  };
}

/**
 * @returns {Record<string, ThresholdRule>}
 */
function createInitialThresholdRows() {
  /** @type {Record<string, ThresholdRule>} */
  const o = {};
  for (const k of ALL_ROW_KEYS) {
    o[k] = emptyThresholdRule();
  }
  return o;
}

/**
 * 大众向默认高级规则（便于一键填充；数值为常见科普向参考，可再改）。
 * 约定：时长类为「分钟」、速度为「g/min」、食量为「g」；统计周期为「每 1 天」。
 * - 用餐时长：单餐不宜过久，上限 90 分钟
 * - 用餐速度：过快不利消化，单日参考上限 35 g/min
 * - 用餐剩余量：剩太多提示浪费，上限 150 g
 * - 用餐摄入量：吃太少不利健康，下限 350 g
 * - 每餐进餐时间：每餐至少约 15 分钟，利于细嚼慢咽
 *
 * @type {Record<string, ThresholdRule>}
 */
const DEFAULT_THRESHOLD_RULES = {
  duration: {
    intervalN: '1',
    timeUnit: 'day',
    boundType: 'max',
    boundValue: '90',
    boundMin: '',
    boundMax: '',
  },
  speed: {
    intervalN: '1',
    timeUnit: 'day',
    boundType: 'max',
    boundValue: '35',
    boundMin: '',
    boundMax: '',
  },
  remaining: {
    intervalN: '1',
    timeUnit: 'day',
    boundType: 'max',
    boundValue: '150',
    boundMin: '',
    boundMax: '',
  },
  intake: {
    intervalN: '1',
    timeUnit: 'day',
    boundType: 'min',
    boundValue: '350',
    boundMin: '',
    boundMax: '',
  },
  mealTime: {
    intervalN: '1',
    timeUnit: 'day',
    boundType: 'min',
    boundValue: '15',
    boundMin: '',
    boundMax: '',
  },
};

/**
 * @returns {Record<string, ThresholdRule>}
 */
function cloneDefaultThresholdRows() {
  /** @type {Record<string, ThresholdRule>} */
  const o = {};
  for (const k of ALL_ROW_KEYS) {
    o[k] = { ...DEFAULT_THRESHOLD_RULES[k] };
  }
  return o;
}

/**
 * @param {ThresholdRule} rule
 * @returns {string | null} 错误文案；null 表示通过
 */
function validateRule(rule) {
  const n = String(rule.intervalN).trim();
  if (n === '' || Number.isNaN(Number(n)) || Number(n) <= 0 || !Number.isFinite(Number(n))) {
    return '请填写「每」后面的正数字';
  }
  if (rule.boundType === 'max' || rule.boundType === 'min') {
    const v = String(rule.boundValue).trim();
    if (v === '' || Number.isNaN(Number(v)) || !Number.isFinite(Number(v))) {
      return '请填写阈值';
    }
  }
  if (rule.boundType === 'range') {
    const a = String(rule.boundMin).trim();
    const b = String(rule.boundMax).trim();
    if (a === '' || Number.isNaN(Number(a)) || !Number.isFinite(Number(a))) {
      return '请填写区间下限';
    }
    if (b === '' || Number.isNaN(Number(b)) || !Number.isFinite(Number(b))) {
      return '请填写区间上限';
    }
    if (Number(a) > Number(b)) {
      return '区间下限不能大于上限';
    }
  }
  return null;
}

/**
 * @param {ThresholdRule} rule
 * @returns {string}
 */
function formatRuleSummary(rule) {
  const err = validateRule(rule);
  if (err) return '尚未完成有效设置';
  const unit = TIME_UNIT_OPTIONS.find((o) => o.value === rule.timeUnit)?.label ?? rule.timeUnit;
  const bt = BOUND_TYPE_OPTIONS.find((o) => o.value === rule.boundType)?.label ?? rule.boundType;
  if (rule.boundType === 'range') {
    return `每 ${rule.intervalN} ${unit}，${bt} ${rule.boundMin} ～ ${rule.boundMax}`;
  }
  return `每 ${rule.intervalN} ${unit}，${bt} ${rule.boundValue}`;
}

/**
 * 高级设置内：每 N [单位] ，设置 最大/最小/区间 + 数值
 * @param {{ rule: ThresholdRule, onChange: (patch: Partial<ThresholdRule>) => void }} props
 * @returns {JSX.Element}
 */
function ThresholdRuleEditor({ rule, onChange }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 1,
        rowGap: 1.5,
      }}
    >
      <Typography variant="body2" sx={{ color: '#64748B', fontWeight: 500 }}>
        每
      </Typography>
      <TextField
        size="small"
        type="number"
        inputProps={{ min: 1, step: 1 }}
        placeholder="数字"
        value={rule.intervalN}
        onChange={(e) => onChange({ intervalN: e.target.value })}
        variant="outlined"
        sx={{ width: 88 }}
      />
      <TextField
        select
        size="small"
        value={rule.timeUnit}
        onChange={(e) => onChange({ timeUnit: /** @type {TimeUnit} */ (e.target.value) })}
        variant="outlined"
        sx={{ width: 100 }}
      >
        {TIME_UNIT_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>
      <Typography variant="body2" sx={{ color: '#64748B' }}>
        ，设置
      </Typography>
      <TextField
        select
        size="small"
        value={rule.boundType}
        onChange={(e) => onChange({ boundType: /** @type {BoundType} */ (e.target.value) })}
        variant="outlined"
        sx={{ width: 104 }}
      >
        {BOUND_TYPE_OPTIONS.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </TextField>

      {rule.boundType === 'range' ? (
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap">
          <TextField
            size="small"
            type="number"
            label="下限"
            value={rule.boundMin}
            onChange={(e) => onChange({ boundMin: e.target.value })}
            variant="outlined"
            sx={{ width: 108 }}
          />
          <Typography variant="body2" sx={{ color: '#94A3B8' }}>
            ～
          </Typography>
          <TextField
            size="small"
            type="number"
            label="上限"
            value={rule.boundMax}
            onChange={(e) => onChange({ boundMax: e.target.value })}
            variant="outlined"
            sx={{ width: 108 }}
          />
        </Stack>
      ) : (
        <TextField
          size="small"
          type="number"
          label={rule.boundType === 'max' ? '不超过' : '不低于'}
          value={rule.boundValue}
          onChange={(e) => onChange({ boundValue: e.target.value })}
          variant="outlined"
          sx={{ width: 120 }}
        />
      )}
    </Box>
  );
}

/**
 * 预警设置：指标勾选 + 高级设置弹窗 + 通知联系人
 */
export default function AlertSettings() {
  const [checked, setChecked] = useState({
    duration: false,
    speed: false,
    remaining: false,
    intake: false,
    mealTime: false,
  });
  const [thresholdRows, setThresholdRows] = useState(() => createInitialThresholdRows());
  /** @type {[AlertContact[], function]} */
  const [contacts, setContacts] = useState([]);
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftEmail, setDraftEmail] = useState('');

  /** @type {[string | null, function]} */
  const [advancedDialogKey, setAdvancedDialogKey] = useState(null);
  const [advancedDraft, setAdvancedDraft] = useState(() => emptyThresholdRule());
  const [advancedDialogError, setAdvancedDialogError] = useState('');
  const [criteriaError, setCriteriaError] = useState('');
  const [defaultAppliedTip, setDefaultAppliedTip] = useState('');

  /**
   * @param {string} key
   * @returns {void}
   */
  const toggleCriterion = (key) => {
    const willEnable = !checked[key];
    if (willEnable) {
      const err = validateRule(thresholdRows[key]);
      if (err) {
        setCriteriaError(
          `「${CRITERIA_LABEL_MAP[key] || key}」未在高级设置中填写完整规则：${err}。请先点击「高级设置」填写后再勾选。`,
        );
        return;
      }
    }
    setCriteriaError('');
    setChecked((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * @param {string} key
   * @param {ThresholdRule} next
   * @returns {void}
   */
  const replaceThresholdRow = (key, next) => {
    setThresholdRows((prev) => ({
      ...prev,
      [key]: { ...next },
    }));
  };

  /**
   * @param {string} key
   * @returns {void}
   */
  const openAdvanced = (key) => {
    setAdvancedDraft({ ...thresholdRows[key] });
    setAdvancedDialogError('');
    setAdvancedDialogKey(key);
  };

  const closeAdvanced = useCallback(() => {
    setAdvancedDialogKey(null);
    setAdvancedDialogError('');
  }, []);

  /**
   * 一键写入全部指标的默认高级规则（仍须手动勾选开关）。
   * @returns {void}
   */
  const applyDefaultThresholds = useCallback(() => {
    const next = cloneDefaultThresholdRows();
    setThresholdRows(next);
    setCriteriaError('');
    setDefaultAppliedTip(
      '已为全部指标写入大众向默认值（每 1 天统计：时长/进餐时间上限或下限为分钟量级，速度 g/min，食量 g）。可按需点开「高级设置」微调后再勾选。',
    );
    if (advancedDialogKey) {
      setAdvancedDraft({ ...next[advancedDialogKey] });
      setAdvancedDialogError('');
    }
  }, [advancedDialogKey]);

  /**
   * @returns {void}
   */
  const saveAdvanced = () => {
    if (!advancedDialogKey) return;
    const err = validateRule(advancedDraft);
    if (err) {
      setAdvancedDialogError(err);
      return;
    }
    replaceThresholdRow(advancedDialogKey, advancedDraft);
    setAdvancedDialogError('');
    setAdvancedDialogKey(null);
  };

  /**
   * @param {string} raw
   * @returns {boolean}
   */
  const isLooseEmail = (raw) => {
    const t = String(raw).trim();
    if (!t) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
  };

  const openAddContactDialog = useCallback(() => {
    setDraftName('');
    setDraftEmail('');
    setContactDialogOpen(true);
  }, []);

  const closeAddContactDialog = useCallback(() => {
    setContactDialogOpen(false);
  }, []);

  /**
   * @returns {void}
   */
  const confirmAddContact = () => {
    const name = draftName.trim();
    const email = draftEmail.trim();
    if (!name || !isLooseEmail(email)) return;
    setContacts((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name,
        email,
      },
    ]);
    setContactDialogOpen(false);
  };

  /**
   * @param {string} id
   * @returns {void}
   */
  const removeContact = (id) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
  };

  const cardShadow = '0 2px 8px rgba(0, 0, 0, 0.04)';
  const headerGradient = 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)';
  const btnGradient = 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)';
  const btnGradientHover = 'linear-gradient(135deg, #008573 0%, #006B5C 100%)';

  const advancedTitle = advancedDialogKey ? CRITERIA_LABEL_MAP[advancedDialogKey] || advancedDialogKey : '';

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
          预警功能
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>
          请先在「高级设置」中填写「每 N 单位时间 + 最大/最小/区间」规则，再勾选对应指标；并添加接收预警邮件的联系人
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              overflow: 'visible',
              borderRadius: 3,
              boxShadow: cardShadow,
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { boxShadow: '0 8px 24px rgba(0, 191, 165, 0.12)' },
            }}
          >
            <Box
              sx={{
                p: 3,
                background: headerGradient,
                color: 'white',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <AlertHeaderIcon />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                预警指标
              </Typography>
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
              {criteriaError ? (
                <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setCriteriaError('')}>
                  {criteriaError}
                </Alert>
              ) : null}

              {defaultAppliedTip ? (
                <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setDefaultAppliedTip('')}>
                  {defaultAppliedTip}
                </Alert>
              ) : null}

              <Box
                sx={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  gap: 1.5,
                  mb: 2,
                }}
              >
                <Chip
                  label="可勾选（需先完成高级设置）"
                  size="small"
                  sx={{
                    fontWeight: 600,
                    bgcolor: 'rgba(0, 191, 165, 0.08)',
                    color: 'primary.main',
                    border: 'none',
                  }}
                />
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DefaultPresetIcon />}
                  onClick={applyDefaultThresholds}
                  sx={{
                    borderRadius: 2,
                    textTransform: 'none',
                    fontWeight: 600,
                    borderColor: 'primary.main',
                    color: 'primary.main',
                  }}
                >
                  默认设置
                </Button>
              </Box>

              <Stack divider={<Divider flexItem sx={{ borderColor: '#F1F5F9' }} />}>
                {CRITERIA_KEYS.map(({ key, label }) => (
                  <Box
                    key={key}
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'stretch', sm: 'center' },
                      justifyContent: 'space-between',
                      gap: 1.5,
                      py: 2,
                    }}
                  >
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={checked[key]}
                          onChange={() => toggleCriterion(key)}
                          sx={{ color: '#94A3B8', '&.Mui-checked': { color: 'primary.main' } }}
                        />
                      )}
                      label={(
                        <Typography sx={{ fontWeight: 600, color: '#1E293B' }}>
                          {label}
                        </Typography>
                      )}
                      sx={{ m: 0, alignItems: 'center', flex: { sm: '0 0 auto' } }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, gap: 1, flex: 1, minWidth: 0 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<TuneIcon />}
                        onClick={() => openAdvanced(key)}
                        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' }, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        高级设置
                      </Button>
                      <Typography variant="caption" sx={{ color: '#94A3B8', textAlign: { xs: 'left', sm: 'right' }, maxWidth: 360, alignSelf: { sm: 'flex-end' } }}>
                        {formatRuleSummary(thresholdRows[key])}
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Stack>

              <Card
                variant="outlined"
                sx={{
                  mt: 2,
                  borderColor: '#E2E8F0',
                  bgcolor: '#F8FAFC',
                  borderRadius: 2,
                  boxShadow: 'none',
                }}
              >
                <CardContent sx={{ py: 2, '&:last-child': { pb: 2 } }}>
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: { xs: 'column', sm: 'row' },
                      alignItems: { xs: 'stretch', sm: 'center' },
                      justifyContent: 'space-between',
                      gap: 1.5,
                    }}
                  >
                    <FormControlLabel
                      control={(
                        <Checkbox
                          checked={checked.mealTime}
                          onChange={() => toggleCriterion('mealTime')}
                          sx={{ color: '#94A3B8', '&.Mui-checked': { color: 'primary.main' } }}
                        />
                      )}
                      label={(
                        <Typography sx={{ fontWeight: 700, color: '#1E293B' }}>
                          每餐进餐时间
                        </Typography>
                      )}
                      sx={{ m: 0, alignItems: 'center', flex: { sm: '0 0 auto' } }}
                    />
                    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: { xs: 'stretch', sm: 'flex-end' }, gap: 1, flex: 1, minWidth: 0 }}>
                      <Button
                        variant="outlined"
                        size="small"
                        startIcon={<TuneIcon />}
                        onClick={() => openAdvanced('mealTime')}
                        sx={{ alignSelf: { xs: 'stretch', sm: 'flex-end' }, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                      >
                        高级设置
                      </Button>
                      <Typography variant="caption" sx={{ color: '#94A3B8', textAlign: { xs: 'left', sm: 'right' }, maxWidth: 360, alignSelf: { sm: 'flex-end' } }}>
                        {formatRuleSummary(thresholdRows.mealTime)}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card
            sx={{
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 3,
              boxShadow: cardShadow,
              transition: 'transform 0.2s, box-shadow 0.2s',
              '&:hover': { boxShadow: '0 8px 24px rgba(0, 191, 165, 0.1)' },
            }}
          >
            <Box
              sx={{
                p: 3,
                background: headerGradient,
                color: 'white',
                borderTopLeftRadius: 12,
                borderTopRightRadius: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <ContactHeaderIcon />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                通知联系人
              </Typography>
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ color: '#64748B', fontWeight: 600, mb: 1.5 }}>
                已添加联系人 {contacts.length > 0 ? `(${contacts.length})` : ''}
              </Typography>

              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3, minHeight: 44 }}>
                {contacts.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8', py: 1 }}>
                    暂无通知邮箱，点击下方按钮添加
                  </Typography>
                ) : (
                  contacts.map((c) => (
                    <Chip
                      key={c.id}
                      label={c.email ? `${c.name} · ${c.email}` : c.name}
                      onDelete={() => removeContact(c.id)}
                      deleteIcon={<CloseIcon sx={{ fontSize: 18 }} />}
                      sx={{
                        fontWeight: 600,
                        bgcolor: 'rgba(0, 191, 165, 0.1)',
                        color: 'primary.main',
                        border: 'none',
                      }}
                    />
                  ))
                )}
              </Stack>

              <Box sx={{ mt: 'auto' }}>
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  startIcon={<AddIcon />}
                  onClick={openAddContactDialog}
                  sx={{
                    py: 1.5,
                    borderRadius: 2,
                    fontWeight: 700,
                    background: btnGradient,
                    boxShadow: '0 4px 14px rgba(0, 191, 165, 0.35)',
                    '&:hover': {
                      background: btnGradientHover,
                      boxShadow: '0 6px 20px rgba(0, 191, 165, 0.4)',
                    },
                  }}
                >
                  添加邮件联系人
                </Button>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(advancedDialogKey)}
        onClose={closeAdvanced}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 4 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>
          {advancedTitle} — 高级设置
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            按以下格式填写：每（数字）（单位时间），设置最大值或最小值或区间及对应数值。
          </Typography>
          <ThresholdRuleEditor
            rule={advancedDraft}
            onChange={(patch) => {
              setAdvancedDraft((prev) => ({ ...prev, ...patch }));
              setAdvancedDialogError('');
            }}
          />
          {advancedDialogError ? (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              {advancedDialogError}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAdvanced} sx={{ color: '#64748B' }}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={saveAdvanced}
            sx={{
              borderRadius: 2,
              px: 3,
              background: btnGradient,
              '&:hover': { background: btnGradientHover },
            }}
          >
            保存
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={contactDialogOpen}
        onClose={closeAddContactDialog}
        PaperProps={{ sx: { borderRadius: 4, p: 0.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>添加邮件联系人</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              label="姓名"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            />
            <TextField
              label="通知邮箱"
              type="email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
              placeholder="name@example.com"
              error={draftEmail.trim() !== '' && !isLooseEmail(draftEmail)}
              helperText={
                draftEmail.trim() !== '' && !isLooseEmail(draftEmail)
                  ? '请输入有效邮箱地址'
                  : '预警将发送至该邮箱'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddContactDialog} sx={{ color: '#64748B' }}>
            取消
          </Button>
          <Button
            variant="contained"
            onClick={confirmAddContact}
            disabled={!draftName.trim() || !isLooseEmail(draftEmail)}
            sx={{
              borderRadius: 2,
              px: 3,
              background: btnGradient,
              '&:hover': { background: btnGradientHover },
            }}
          >
            确定
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

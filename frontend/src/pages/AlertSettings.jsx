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
 * @property {string} intervalN Every N units of time
 * @property {TimeUnit} timeUnit
 * @property {BoundType} boundType
 * @property {string} boundValue Single threshold for max/min
 * @property {string} boundMin Lower bound of a range
 * @property {string} boundMax Upper bound of a range
 */

const CRITERIA_KEYS = [
  { key: 'duration', label: 'Meal Duration' },
  { key: 'speed', label: 'Eating Speed' },
  { key: 'remaining', label: 'Leftover Amount' },
  { key: 'intake', label: 'Intake Amount' },
];

/** @type {Record<string, string>} */
const CRITERIA_LABEL_MAP = {
  duration: 'Meal Duration',
  speed: 'Eating Speed',
  remaining: 'Leftover Amount',
  intake: 'Intake Amount',
  mealTime: 'Meal Time Window',
};

const ALL_ROW_KEYS = ['duration', 'speed', 'remaining', 'intake', 'mealTime'];

/** @type {{ value: TimeUnit, label: string }[]} */
const TIME_UNIT_OPTIONS = [
  { value: 'minute', label: 'Minute' },
  { value: 'hour', label: 'Hour' },
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
];

/** @type {{ value: BoundType, label: string }[]} */
const BOUND_TYPE_OPTIONS = [
  { value: 'max', label: 'Maximum' },
  { value: 'min', label: 'Minimum' },
  { value: 'range', label: 'Range' },
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
 * Default advanced rules for one-click setup.
 * Convention: duration in minutes, speed in g/min, amount in g; period is every 1 day.
 * - Meal duration: upper bound 90 minutes
 * - Eating speed: upper bound 35 g/min per day
 * - Leftover amount: upper bound 150 g
 * - Intake amount: lower bound 350 g
 * - Meal time window: at least around 15 minutes per meal
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
 * @returns {string | null} Error text; null means valid
 */
function validateRule(rule) {
  const n = String(rule.intervalN).trim();
  if (n === '' || Number.isNaN(Number(n)) || Number(n) <= 0 || !Number.isFinite(Number(n))) {
    return 'Please enter a positive number for "Every".';
  }
  if (rule.boundType === 'max' || rule.boundType === 'min') {
    const v = String(rule.boundValue).trim();
    if (v === '' || Number.isNaN(Number(v)) || !Number.isFinite(Number(v))) {
      return 'Please enter a threshold value.';
    }
  }
  if (rule.boundType === 'range') {
    const a = String(rule.boundMin).trim();
    const b = String(rule.boundMax).trim();
    if (a === '' || Number.isNaN(Number(a)) || !Number.isFinite(Number(a))) {
      return 'Please enter the lower bound.';
    }
    if (b === '' || Number.isNaN(Number(b)) || !Number.isFinite(Number(b))) {
      return 'Please enter the upper bound.';
    }
    if (Number(a) > Number(b)) {
      return 'Lower bound cannot be greater than upper bound.';
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
  if (err) return 'Invalid configuration';
  const unit = TIME_UNIT_OPTIONS.find((o) => o.value === rule.timeUnit)?.label ?? rule.timeUnit;
  const bt = BOUND_TYPE_OPTIONS.find((o) => o.value === rule.boundType)?.label ?? rule.boundType;
  if (rule.boundType === 'range') {
    return `Every ${rule.intervalN} ${unit}, ${bt} ${rule.boundMin} to ${rule.boundMax}`;
  }
  return `Every ${rule.intervalN} ${unit}, ${bt} ${rule.boundValue}`;
}

/**
 * Advanced settings: every N [unit], set max/min/range + values
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
        Every
      </Typography>
      <TextField
        size="small"
        type="number"
        inputProps={{ min: 1, step: 1 }}
        placeholder="Number"
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
        set
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
            label="Lower"
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
            label="Upper"
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
          label={rule.boundType === 'max' ? 'No more than' : 'No less than'}
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
 * Alert settings: metric toggles + advanced dialog + notification contacts
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
          `"${CRITERIA_LABEL_MAP[key] || key}" is incomplete in Advanced Settings: ${err}. Please complete it before enabling this metric.`,
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
   * One-click write default advanced rules for all metrics (toggle still required manually).
   * @returns {void}
   */
  const applyDefaultThresholds = useCallback(() => {
    const next = cloneDefaultThresholdRows();
    setThresholdRows(next);
    setCriteriaError('');
    setDefaultAppliedTip(
      'Default values have been written for all metrics (every 1 day: duration/time-window in minutes, speed in g/min, amount in g). Fine-tune in Advanced Settings before enabling.',
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
  /**
   * Keep card radius aligned with theme `MuiCard` (20px) and top bar.
   */
  const alertCardRadius = '20px';
  const headerGradient = 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)';
  const btnGradient = 'linear-gradient(135deg, #00BFA5 0%, #008573 100%)';
  const btnGradientHover = 'linear-gradient(135deg, #008573 0%, #006B5C 100%)';

  const advancedTitle = advancedDialogKey ? CRITERIA_LABEL_MAP[advancedDialogKey] || advancedDialogKey : '';

  return (
    <Box sx={{ pb: 4, maxWidth: 1000, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 800, color: '#1E293B', mb: 1 }}>
          Alert Settings
        </Typography>
        <Typography variant="body1" sx={{ color: '#64748B' }}>
          First configure each metric in Advanced Settings (every N time units + max/min/range), then enable it and add email recipients.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card
            sx={{
              overflow: 'visible',
              borderRadius: alertCardRadius,
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
                borderTopLeftRadius: alertCardRadius,
                borderTopRightRadius: alertCardRadius,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <AlertHeaderIcon />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Alert Metrics
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
                  label="Toggle available after advanced setup"
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
                  Default Setup
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
                        Advanced Settings
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
                          Meal Time Window
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
                        Advanced Settings
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
              overflow: 'visible',
              borderRadius: alertCardRadius,
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
                borderTopLeftRadius: alertCardRadius,
                borderTopRightRadius: alertCardRadius,
                display: 'flex',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}>
                <ContactHeaderIcon />
              </Avatar>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Notification Contacts
              </Typography>
            </Box>
            <CardContent sx={{ p: { xs: 2, sm: 3 }, flex: 1, display: 'flex', flexDirection: 'column' }}>
              <Typography variant="subtitle2" sx={{ color: '#64748B', fontWeight: 600, mb: 1.5 }}>
                Added Contacts {contacts.length > 0 ? `(${contacts.length})` : ''}
              </Typography>

              <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mb: 3, minHeight: 44 }}>
                {contacts.length === 0 ? (
                  <Typography variant="body2" sx={{ color: '#94A3B8', py: 1 }}>
                    No notification email yet. Click below to add one.
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
                  Add Email Contact
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
          {advancedTitle} - Advanced Settings
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: '#64748B', mb: 2 }}>
            Format: Every (number) (time unit), then set maximum, minimum, or range with values.
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
            Cancel
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
            Save
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={contactDialogOpen}
        onClose={closeAddContactDialog}
        PaperProps={{ sx: { borderRadius: 4, p: 0.5 } }}
      >
        <DialogTitle sx={{ fontWeight: 800, color: '#1E293B' }}>Add Email Contact</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1, minWidth: 300 }}>
            <TextField
              label="Name"
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              fullWidth
              size="small"
              variant="outlined"
            />
            <TextField
              label="Notification Email"
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
                  ? 'Please enter a valid email address.'
                  : 'Alerts will be sent to this email.'
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={closeAddContactDialog} sx={{ color: '#64748B' }}>
            Cancel
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
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

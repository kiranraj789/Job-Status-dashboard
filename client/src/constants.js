// Single source of truth for display metadata (colors/labels) shared by every
// view. Job statuses and execution statuses share one STATUS map because
// views render both and the same visual language applies.

export const STATUS = {
  active:    { label: 'Active',    color: '#047857' },
  paused:    { label: 'Paused',    color: '#b45309' },
  failed:    { label: 'Failed',    color: '#b91c1c' },
  completed: { label: 'Completed', color: '#4b5563' },
  blocked:   { label: 'Blocked',   color: '#6d28d9' },
  success:   { label: 'Success',   color: '#047857' },
  running:   { label: 'Running',   color: '#1d4ed8' },
  queued:    { label: 'Queued',    color: '#6d28d9' },
  timeout:   { label: 'Timeout',   color: '#b45309' },
  cancelled: { label: 'Cancelled', color: '#4b5563' }
};

export const SEVERITY = {
  info:     { label: 'Info',     color: '#1d4ed8' },
  warning:  { label: 'Warning',  color: '#b45309' },
  error:    { label: 'Error',    color: '#b91c1c' },
  critical: { label: 'Critical', color: '#b91c1c' }
};

export const ALERT_TYPE = {
  failure:     { label: 'Failure',     color: '#b91c1c' },
  warning:     { label: 'Warning',     color: '#b45309' },
  predictive:  { label: 'Predictive',  color: '#6d28d9' },
  dependency:  { label: 'Dependency',  color: '#c2410c' },
  performance: { label: 'Performance', color: '#1d4ed8' },
  critical:    { label: 'Critical',    color: '#b91c1c' }
};

export const PRIORITY = {
  critical: '#b91c1c',
  high:     '#b45309',
  medium:   '#1d4ed8',
  low:      '#4b5563'
};

export const RISK = {
  high:   { label: 'High',   color: '#b91c1c' },
  medium: { label: 'Medium', color: '#b45309' },
  low:    { label: 'Low',    color: '#047857' }
};

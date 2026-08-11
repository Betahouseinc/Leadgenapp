// Single source of truth for lead pipeline statuses.
// Add/reorder here only — every dropdown, filter and badge reads from this.

export const LEAD_STATUSES = [
  { value: 'new',            label: 'New',            color: '#5C5240', bg: '#F1EFEA' },
  { value: 'contacted',      label: 'Contacted',      color: '#109840', bg: '#EFF8F1' },
  { value: 'follow_up',      label: 'Follow-up',      color: '#B45309', bg: '#FEF3C7' },
  { value: 'qualified',      label: 'Qualified',      color: '#1A8A72', bg: '#E0F5F0' },
  { value: 'not_interested', label: 'Not interested', color: '#B91C1C', bg: '#FEE2E2' },
  { value: 'converted',      label: 'Converted',      color: '#047857', bg: '#D1FAE5' },
]

export const STATUS_VALUES = LEAD_STATUSES.map(s => s.value)

const BY_VALUE = Object.fromEntries(LEAD_STATUSES.map(s => [s.value, s]))

// Legacy statuses that existed before the pipeline was expanded.
const LEGACY_MAP = { rejected: 'not_interested' }

export function normaliseStatus(value) {
  if (!value) return 'new'
  const mapped = LEGACY_MAP[value] || value
  return BY_VALUE[mapped] ? mapped : 'new'
}

export function statusMeta(value) {
  return BY_VALUE[normaliseStatus(value)]
}

export function statusLabel(value) {
  return statusMeta(value).label
}

// Statuses that represent "we have reached out" — used for the contacted count.
export const ENGAGED_STATUSES = ['contacted', 'follow_up', 'qualified', 'converted']

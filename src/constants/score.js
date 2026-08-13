// Single source of truth for score bands.
//
// These thresholds previously disagreed in three places: the table bar split at
// 75/50, the stats bar counted "high" at 70+, and the FAQ told customers 80/60.
// A lead could be green in one place and amber in another. 70 is the canonical
// high-water mark — it is what the stats card and the daily high-score export
// both use.

export const HIGH_SCORE = 70
export const MEDIUM_SCORE = 40

export const SCORE_BANDS = {
  high:     { label: 'High',     color: '#047857', bg: '#D1FAE5' },
  medium:   { label: 'Medium',   color: '#B45309', bg: '#FEF3C7' },
  low:      { label: 'Low',      color: '#B91C1C', bg: '#FEE2E2' },
  unscored: { label: 'Unscored', color: '#6B7280', bg: 'rgba(0,0,0,0.05)' },
}

export function scoreBand(score) {
  if (score == null) return SCORE_BANDS.unscored
  if (score >= HIGH_SCORE) return SCORE_BANDS.high
  if (score >= MEDIUM_SCORE) return SCORE_BANDS.medium
  return SCORE_BANDS.low
}

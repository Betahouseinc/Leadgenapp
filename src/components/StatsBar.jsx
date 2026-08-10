import { ENGAGED_STATUSES, normaliseStatus } from '../constants/leadStatus'

const T = {
  surface: '#FFFFFF',
  border: 'rgba(11,13,12,0.12)',
  ink: '#0B0D0C',
  ink2: '#4B5560',
  blue: '#109840',
  blueL: '#EFF8F1',
  teal: '#7BCF16',
  tealL: '#F3FBEA',
}

function StatCard({ label, value, accent = T.blue }) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      flex: '1 1 calc(50% - 6px)',
      minWidth: 0,
      maxWidth: '100%',
      boxSizing: 'border-box',
    }}>
      <div style={{ fontSize: 12, color: T.ink2, marginBottom: 6, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
        {label}
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: accent }}>
        {value ?? '—'}
      </div>
    </div>
  )
}

export default function StatsBar({ leads }) {
  const total = leads.length
  const today = new Date().toDateString()
  const newToday = leads.filter(l => new Date(l.created_at).toDateString() === today).length

  // "High score" reflects lead quality from AI scoring; the pipeline count is
  // tracked separately so an empty pipeline never looks like zero good leads.
  const highScore = leads.filter(l => (l.score || 0) >= 70).length
  const engaged = leads.filter(l => ENGAGED_STATUSES.includes(normaliseStatus(l.status))).length

  // Unscored leads (AI scoring failed) would drag the average down misleadingly.
  const scored = leads.filter(l => typeof l.score === 'number' && l.score > 0)
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, l) => s + l.score, 0) / scored.length)
    : 0

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'stretch' }}>
      <StatCard label="Total Leads" value={total} accent={T.blue} />
      <StatCard label="New Today" value={newToday} accent="#2D7DD2" />
      <StatCard label="High Score (70+)" value={highScore} accent={T.teal} />
      <StatCard label="In Pipeline" value={engaged} accent="#B45309" />
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: 8, padding: '12px 20px',
        flex: '1 1 100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, color: '#7C3AED', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Score</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#7C3AED' }}>{avgScore ?? '—'}</div>
      </div>
    </div>
  )
}

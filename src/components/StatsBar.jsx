import { HIGH_SCORE } from '../constants/score'

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

// `stats` comes from the lead_stats() RPC. It used to be derived in the browser
// from the full lead array, which only worked while the page downloaded every
// row; with the table paginated the client sees one page and cannot total it.
export default function StatsBar({ stats }) {
  const fmt = (v) => (typeof v === 'number' ? v.toLocaleString('en-IN') : '—')

  const total = stats?.total
  const newToday = stats?.new_today
  const highScore = stats?.high_score
  const engaged = stats?.engaged
  const avgScore = stats?.avg_score

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20, alignItems: 'stretch' }}>
      <StatCard label="Total Leads" value={fmt(total)} accent={T.blue} />
      <StatCard label="New Today" value={fmt(newToday)} accent="#087A32" />
      <StatCard label={`High Score (${HIGH_SCORE}+)`} value={fmt(highScore)} accent={T.teal} />
      <StatCard label="In Pipeline" value={fmt(engaged)} accent="#B45309" />
      <div style={{
        background: T.surface, border: `0.5px solid ${T.border}`,
        borderRadius: 8, padding: '12px 20px',
        flex: '1 1 100%', boxSizing: 'border-box',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ fontSize: 12, color: '#087A32', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Score</div>
        <div style={{ fontSize: 28, fontWeight: 700, color: '#087A32' }}>{fmt(avgScore)}</div>
      </div>
    </div>
  )
}

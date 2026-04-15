const T = {
  surface: '#FFFFFF',
  border: 'rgba(0,0,0,0.12)',
  ink: '#2C2416',
  ink2: '#5C5240',
  blue: '#2563EB',
  blueL: '#EFF6FF',
  teal: '#1A8A72',
  tealL: '#E0F5F0',
}

function StatCard({ label, value, accent = T.blue, accentL = T.blueL }) {
  return (
    <div style={{
      background: T.surface,
      border: `0.5px solid ${T.border}`,
      borderRadius: 8,
      padding: '16px 20px',
      flex: 1,
      minWidth: 140,
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
  const qualified = leads.filter(l => l.status === 'qualified').length
  const avgScore = total > 0 ? Math.round(leads.reduce((s, l) => s + (l.score || 0), 0) / total) : 0

  return (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
      <StatCard label="Total Leads" value={total} accent={T.blue} />
      <StatCard label="New Today" value={newToday} accent="#2D7DD2" accentL="#E8F2FC" />
      <StatCard label="Qualified" value={qualified} accent={T.teal} accentL={T.tealL} />
      <StatCard label="Avg Score" value={avgScore} accent="#7C3AED" accentL="#EDE9FE" />
    </div>
  )
}

import { useState } from 'react'
import { supabase } from '../lib/supabase'

const T = {
  surface: '#FFFFFF',
  bg: '#FAFAF7',
  border: 'rgba(0,0,0,0.12)',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  blue: '#2563EB',
  blueL: '#EFF6FF',
  teal: '#1A8A72',
  error: '#C44B4B',
  errorL: '#FDEAEA',
}

const INDUSTRIES = [
  'Real estate', 'IT Software', 'Manufacturing',
  'Healthcare', 'Retail', 'Education', 'Pharma',
]

export default function ScrapeModal({ onClose, onDone }) {
  const [industry, setIndustry] = useState('Real estate')
  const [city, setCity] = useState('Bengaluru')
  const [sources, setSources] = useState({ gmaps: true, linkedin: false })
  const [limit, setLimit] = useState(50)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const toggleSource = (key) => setSources(s => ({ ...s, [key]: !s[key] }))

  const handleRun = async () => {
    const selectedSources = Object.entries(sources).filter(([, v]) => v).map(([k]) => k)
    if (selectedSources.length === 0) { setError('Select at least one source'); return }

    setError('')
    setRunning(true)
    setProgress(30)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-leads`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ industry, city, sources: selectedSources, limit }),
        }
      )

      setProgress(100)

      if (!res.ok) {
        const body = await res.text()
        throw new Error(body || `HTTP ${res.status}`)
      }

      setDone(true)

      // Poll leads table every 10s — refresh dashboard when new leads arrive
      const { data: before } = await supabase.from('leads').select('id', { count: 'exact' })
      const beforeCount = before?.length || 0
      let polls = 0
      let pollId
      pollId = setInterval(async () => {
        polls++
        const { data: after } = await supabase.from('leads').select('id', { count: 'exact' })
        const afterCount = after?.length || 0
        if (afterCount > beforeCount || polls >= 36) {
          clearInterval(pollId)
          onDone()
          onClose()
        }
      }, 10000)

    } catch (err) {
      setError(err.message)
      setRunning(false)
      setProgress(0)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={!running ? onClose : undefined}
        style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.3)',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: T.surface,
            border: `0.5px solid ${T.border}`,
            borderRadius: 8,
            padding: '28px 32px',
            width: '100%',
            maxWidth: 440,
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 20 }}>
            Run lead scrape
          </div>

          {/* Industry */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={labelStyle}>Industry</div>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              disabled={running}
              style={inputStyle}
            >
              {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
            </select>
          </label>

          {/* City */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={labelStyle}>City</div>
            <input
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              disabled={running}
              style={inputStyle}
            />
          </label>

          {/* Sources */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Sources</div>
            <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
              {[['gmaps', 'Google Maps'], ['linkedin', 'LinkedIn']].map(([key, label]) => (
                <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, color: T.ink }}>
                  <input
                    type="checkbox"
                    checked={sources[key]}
                    onChange={() => toggleSource(key)}
                    disabled={running}
                    style={{ accentColor: T.blue, width: 14, height: 14 }}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Limit */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
              <span>Limit</span>
              <span style={{ color: T.blue, fontWeight: 600 }}>{limit}</span>
            </div>
            <input
              type="range"
              min={10} max={200} step={10}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              disabled={running}
              style={{ width: '100%', accentColor: T.blue, marginTop: 6 }}
            />
          </div>

          {/* Progress bar */}
          {(running || done) && (
            <div style={{
              background: T.bg,
              border: `0.5px solid ${T.border}`,
              borderRadius: 20,
              height: 8,
              overflow: 'hidden',
              marginBottom: 16,
            }}>
              <div style={{
                height: '100%',
                width: `${progress}%`,
                background: done ? T.teal : T.blue,
                borderRadius: 20,
                transition: 'width 0.4s ease, background 0.3s',
              }} />
            </div>
          )}

          {done && (
            <div style={{ color: T.teal, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              ✓ Scrape started! Leads will appear in 5–10 minutes. This window will close automatically.
            </div>
          )}

          {error && (
            <div style={{
              background: T.errorL,
              border: `0.5px solid ${T.error}`,
              borderRadius: 8,
              padding: '9px 12px',
              fontSize: 13,
              color: T.error,
              marginBottom: 12,
            }}>{error}</div>
          )}

          {/* Buttons */}
          {!done && (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button
                onClick={onClose}
                disabled={running}
                style={{
                  padding: '9px 18px',
                  background: 'none',
                  border: `0.5px solid ${T.border}`,
                  borderRadius: 8,
                  fontSize: 13,
                  color: T.ink2,
                  cursor: running ? 'not-allowed' : 'pointer',
                }}
              >Cancel</button>
              <button
                onClick={handleRun}
                disabled={running}
                style={{
                  padding: '9px 20px',
                  background: running ? T.blueL : T.blue,
                  color: running ? T.blue : '#FFF',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: running ? 'not-allowed' : 'pointer',
                }}
              >
                {running ? 'Running…' : 'Run'}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

const labelStyle = {
  fontSize: 12,
  fontWeight: 500,
  color: '#5C5240',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: `0.5px solid rgba(0,0,0,0.12)`,
  borderRadius: 8,
  fontSize: 13,
  color: '#2C2416',
  background: '#FAFAF7',
  outline: 'none',
  boxSizing: 'border-box',
}

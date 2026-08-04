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

// Keys must match INDUSTRY_SEARCH_MAP in supabase/functions/scrape-leads.
// Anything not in that map falls back to searching the raw label, which gives
// noticeably worse Google Maps results — keep the two lists in step.
const INDUSTRIES = {
  'Technology': ['IT Software', 'EdTech', 'FinTech', 'E-commerce'],
  'Marketing & Media': ['Digital Marketing', 'Social Media Marketing', 'Media & Production', 'Events & Entertainment'],
  'Business Services': ['HR & Staffing', 'Legal Services', 'Logistics & Supply Chain', 'Travel & Hospitality'],
  'Traditional': ['Real Estate', 'Manufacturing', 'Construction & Infrastructure', 'Food & Beverage'],
  'Social Sectors': ['Healthcare', 'Education', 'Pharma', 'Retail'],
}

const INDIAN_CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat',
  'Lucknow', 'Noida', 'Gurgaon', 'Kochi', 'Chandigarh',
]

export default function ScrapeModal({ onClose, onDone }) {
  const [selectedCategory, setSelectedCategory] = useState('Traditional')
  const [industry, setIndustry] = useState('Real Estate')
  const [city, setCity] = useState('Bengaluru')
  const [useCustomCity, setUseCustomCity] = useState(false)
  const [customCity, setCustomCity] = useState('')
  const [sources, setSources] = useState({ gmaps: true })
  const [limit, setLimit] = useState(50)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [overQuota, setOverQuota] = useState(false)
  const [saved, setSaved] = useState(null)
  const [done, setDone] = useState(false)

  const toggleSource = (key) => setSources(s => ({ ...s, [key]: !s[key] }))

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setIndustry(INDUSTRIES[category][0])
  }

  const handleRun = async () => {
    const selectedSources = Object.entries(sources).filter(([, v]) => v).map(([k]) => k)
    if (selectedSources.length === 0) { setError('Select at least one source'); return }

    const finalCity = useCustomCity ? customCity.trim() : city
    if (!finalCity) { setError('Please enter a city'); return }

    setError('')
    setOverQuota(false)
    setSaved(null)
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
          body: JSON.stringify({ industry, city: finalCity, sources: selectedSources, limit }),
        }
      )

      setProgress(100)

      const body = await res.json().catch(() => null)

      if (!res.ok) {
        // The backend returns a readable `message` for quota rejections (402).
        // Surface that rather than dumping the raw response at the user.
        if (res.status === 402) {
          setOverQuota(true)
          throw new Error(body?.message || 'You have reached your plan limit for this month.')
        }
        throw new Error(body?.message || body?.error || `Something went wrong (HTTP ${res.status}). Please try again.`)
      }

      setSaved(typeof body?.saved === 'number' ? body.saved : null)
      setDone(true)
      setTimeout(() => { onDone(); onClose() }, 2200)

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
            maxHeight: '90vh',
            overflowY: 'auto',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 20 }}>
            Run lead scrape
          </div>

          {/* Industry category */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={labelStyle}>Industry Category</div>
            <select
              value={selectedCategory}
              onChange={e => handleCategoryChange(e.target.value)}
              disabled={running}
              style={inputStyle}
            >
              {Object.keys(INDUSTRIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </label>

          {/* Industry */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={labelStyle}>Industry</div>
            <select
              value={industry}
              onChange={e => setIndustry(e.target.value)}
              disabled={running}
              style={inputStyle}
            >
              {INDUSTRIES[selectedCategory].map(i => <option key={i}>{i}</option>)}
            </select>
          </label>

          {/* City */}
          <label style={{ display: 'block', marginBottom: 14 }}>
            <div style={labelStyle}>City</div>
            {!useCustomCity ? (
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                disabled={running}
                style={inputStyle}
              >
                {INDIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input
                type="text"
                value={customCity}
                onChange={e => setCustomCity(e.target.value)}
                placeholder="Enter city name"
                disabled={running}
                style={inputStyle}
              />
            )}
            <div
              onClick={() => !running && setUseCustomCity(!useCustomCity)}
              style={{
                marginTop: 6,
                fontSize: 12,
                color: T.blue,
                cursor: running ? 'not-allowed' : 'pointer',
                fontWeight: 500,
              }}
            >
              {useCustomCity ? '← Use dropdown' : '+ Custom city'}
            </div>
          </label>

          {/* Source */}
          <div style={{ marginBottom: 14 }}>
            <div style={labelStyle}>Source</div>
            <div style={{
              marginTop: 6, padding: '8px 12px',
              background: '#EFF6FF', borderRadius: 8,
              fontSize: 13, color: '#2563EB', fontWeight: 500,
            }}>
              📍 Google Maps
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
              {saved === 0
                ? '✓ Finished — no new leads. Every result was already in your list.'
                : saved != null
                  ? `✓ Added ${saved} new lead${saved === 1 ? '' : 's'}. Loading…`
                  : '✓ Scrape complete! Loading leads…'}
            </div>
          )}

          {error && (
            <div style={{
              background: T.errorL,
              border: `0.5px solid ${T.error}`,
              borderRadius: 8,
              padding: '10px 12px',
              fontSize: 13,
              color: T.error,
              marginBottom: 12,
              lineHeight: 1.55,
            }}>
              {error}
              {overQuota && (
                <div style={{ marginTop: 8 }}>
                  <a
                    href="/pricing"
                    style={{
                      display: 'inline-block',
                      padding: '5px 12px',
                      background: T.error,
                      color: '#FFF',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      textDecoration: 'none',
                    }}
                  >See plans →</a>
                </div>
              )}
            </div>
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

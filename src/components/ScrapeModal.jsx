import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { INDUSTRY_GROUPS as INDUSTRIES } from '../constants/industries'

const T = {
  surface: '#FFFFFF',
  bg: '#FFFFFF',
  border: 'rgba(11,13,12,0.12)',
  ink: '#0B0D0C',
  ink2: '#4B5560',
  muted: '#6B7280',
  blue: '#109840',
  blueL: '#EFF8F1',
  teal: '#7BCF16',
  error: '#C44B4B',
  errorL: '#FDEAEA',
}

const INDIAN_CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat',
  'Lucknow', 'Noida', 'Gurgaon', 'Kochi', 'Chandigarh',
]

export default function ScrapeModal({ onClose, onDone, quota }) {
  const [selectedCategory, setSelectedCategory] = useState('Traditional')
  const [industry, setIndustry] = useState('Real Estate')
  const [city, setCity] = useState('Bengaluru')
  const [useCustomCity, setUseCustomCity] = useState(false)
  const [customCity, setCustomCity] = useState('')
  // Google Maps is the only source; LinkedIn was removed from the UI. Kept as
  // an object so the request shape stays the same if a second source returns.
  const [sources] = useState({ gmaps: true })
  const [limit, setLimit] = useState(10)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [error, setError] = useState('')
  const [overQuota, setOverQuota] = useState(false)
  const [saved, setSaved] = useState(null)
  const [updated, setUpdated] = useState(0)
  const [done, setDone] = useState(false)

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setIndustry(INDUSTRIES[category][0])
  }

  // Never let the user ask for more than the backend will allow. Presenting an
  // impossible option and then rejecting it is a worse experience than simply
  // not offering it — a new free user hitting an error on their first click has
  // no way to tell a broken product from a plan limit.
  //
  // Two different ceilings apply and they mean different things. The plan quota
  // is what the customer has left; MAX_PER_RUN is how much one search can
  // physically do in a single pass. Keep this in step with MAX_LEADS_PER_RUN in
  // supabase/functions/scrape-leads/index.ts — 10 is the only size measured to
  // complete against production; 50 was killed mid-run.
  const MAX_PER_RUN = 10
  const allowed = quota
    ? (quota.unlimited ? MAX_PER_RUN : Math.min(quota.allowed ?? 0, MAX_PER_RUN))
    : MAX_PER_RUN
  const cappedByRun = allowed === MAX_PER_RUN && (!quota || quota.unlimited || (quota.allowed ?? 0) > MAX_PER_RUN)
  const sliderMax = Math.max(allowed, 0)

  useEffect(() => {
    if (sliderMax > 0 && limit > sliderMax) setLimit(sliderMax)
  }, [sliderMax, limit])

  // The request is a single blocking call, so we cannot know the real stage.
  // Rather than fake precision, drive the label off elapsed time using the
  // timings we actually observe: Apify dominates, and enabling contact
  // scraping roughly doubled it to 60-90s. Anything past 90s is honest about
  // running long instead of pretending it is nearly done.
  const stageFor = (secs) => {
    if (secs < 4)  return { label: 'Starting search…',            pct: 8 }
    if (secs < 12) return { label: 'Searching Google Maps…',       pct: 22 }
    if (secs < 45) return { label: 'Collecting businesses…',       pct: 45 }
    if (secs < 75) return { label: 'Finding emails from websites…', pct: 68 }
    if (secs < 95) return { label: 'Scoring leads with AI…',        pct: 85 }
    return { label: 'Still working — larger searches take longer…', pct: 92 }
  }

  useEffect(() => {
    if (!running) return
    const started = Date.now()
    setElapsed(0)
    const id = setInterval(() => {
      const secs = Math.floor((Date.now() - started) / 1000)
      setElapsed(secs)
      setProgress(stageFor(secs).pct)
    }, 500)
    return () => clearInterval(id)
  }, [running])

  const handleRun = async () => {
    const selectedSources = Object.entries(sources).filter(([, v]) => v).map(([k]) => k)
    if (selectedSources.length === 0) { setError('Select at least one source'); return }

    const finalCity = useCustomCity ? customCity.trim() : city
    if (!finalCity) { setError('Please enter a city'); return }

    setError('')
    setOverQuota(false)
    setSaved(null)
    setUpdated(0)
    setRunning(true)
    setProgress(6)

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
        // Supabase answers with its own platform-shaped body — a `code` we
        // never send — for several unrelated conditions, so match the specific
        // one rather than the shape. An expired session and a killed worker
        // both arrive as {code, message}, and telling someone their session
        // lapsed because "the search was too large" sends them to fix the
        // wrong thing.
        if (res.status === 401 || body?.code === 'UNAUTHORIZED_NO_AUTH_HEADER') {
          throw new Error('Your session has expired. Please sign in again and retry.')
        }
        // Worker killed for exceeding its memory or time limits. The raw text
        // ("Function failed due to not having enough compute resources")
        // reached customers verbatim. Nothing was saved and no quota was spent,
        // so say that, in words that describe their situation.
        if (res.status === 546 || body?.code === 'WORKER_LIMIT') {
          throw new Error(
            'This search grew too large to finish in one pass, so nothing was saved and none of your allowance was used. Try a smaller number of leads, or a more specific city.'
          )
        }
        throw new Error(body?.message || body?.error || `Something went wrong (HTTP ${res.status}). Please try again.`)
      }

      setSaved(typeof body?.saved === 'number' ? body.saved : null)
      setUpdated(typeof body?.updated === 'number' ? body.updated : 0)
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
            padding: 'clamp(18px, 5vw, 28px) clamp(16px, 5vw, 32px)',
            width: 'calc(100% - 24px)',
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
              background: '#EFF8F1', borderRadius: 8,
              fontSize: 13, color: '#109840', fontWeight: 500,
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
            {/* Step of 10 was fine when the ceiling was 200; with a ceiling of
                10 it would collapse min and max onto the same value and leave a
                slider that cannot move. Below 20, step in ones. */}
            <input
              type="range"
              min={Math.min(5, sliderMax)} max={sliderMax} step={sliderMax < 20 ? 1 : 10}
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              disabled={running || sliderMax === 0}
              style={{ width: '100%', accentColor: T.blue, marginTop: 6 }}
            />
            {quota && !quota.unlimited && (
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                {allowed === 0
                  ? <span style={{ color: T.error }}>
                      No leads left {quota.day_remaining === 0 ? 'today — resets at midnight IST' : 'this month'}.
                    </span>
                  : <>You can request up to {allowed} right now ({quota.remaining} left this month
                      {quota.day_limit != null && `, ${quota.day_remaining} today`}).</>}
              </div>
            )}
            {/* Said only when the run size, not the plan, is what is binding —
                otherwise it reads as a plan restriction the customer just paid
                to remove. */}
            {allowed > 0 && cappedByRun && (
              <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                Up to {MAX_PER_RUN} leads per search — run it again to collect more.
              </div>
            )}
          </div>

          {/* Progress bar */}
          {(running || done) && (
            <div style={{ marginBottom: 16 }}>
              {running && !done && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  marginBottom: 7, fontSize: 12.5,
                }}>
                  <span style={{ color: T.ink, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 7 }}>
                    <span style={{
                      width: 11, height: 11, borderRadius: '50%',
                      border: `2px solid ${T.blue}`, borderTopColor: 'transparent',
                      display: 'inline-block', animation: 'lgspin 0.7s linear infinite',
                    }} />
                    {stageFor(elapsed).label}
                  </span>
                  <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>
                    {Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, '0')}
                  </span>
                </div>
              )}

              <div style={{
                background: T.bg,
                border: `0.5px solid ${T.border}`,
                borderRadius: 20,
                height: 8,
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: done ? T.teal : T.blue,
                  borderRadius: 20,
                  transition: 'width 0.5s ease, background 0.3s',
                }} />
              </div>

              {running && !done && (
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
                  {elapsed < 95
                    ? 'This usually takes 60–90 seconds. Please keep this window open.'
                    : 'Taking longer than usual — still running. Please keep this window open.'}
                </div>
              )}
            </div>
          )}

          {done && (
            <div style={{ color: T.teal, fontSize: 13, marginBottom: 12, fontWeight: 600 }}>
              {/* A re-run of the same search is a normal outcome, not a failure:
                  say what was added and what was already held and refreshed,
                  rather than reporting nothing happened. */}
              {saved === 0
                ? updated > 0
                  ? `✓ Finished — no new leads. All ${updated} result${updated === 1 ? ' was' : 's were'} already in your list; details refreshed.`
                  : '✓ Finished — no new leads. Every result was already in your list.'
                : saved != null
                  ? `✓ Added ${saved} new lead${saved === 1 ? '' : 's'}${updated > 0 ? ` · ${updated} already in your list, refreshed` : ''}. Loading…`
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
  color: '#4B5560',
  marginBottom: 4,
  textTransform: 'uppercase',
  letterSpacing: '0.4px',
}

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  border: `0.5px solid rgba(11,13,12,0.12)`,
  borderRadius: 8,
  fontSize: 13,
  color: '#0B0D0C',
  background: '#FFFFFF',
  outline: 'none',
  boxSizing: 'border-box',
}

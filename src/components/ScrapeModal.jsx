import { useState, useEffect, useRef, useCallback } from 'react'
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
  amber: '#9B5D08',
  amberL: '#FFF4DF',
  error: '#C44B4B',
  errorL: '#FDEAEA',
}

const INDIAN_CITIES = [
  'Bengaluru', 'Mumbai', 'Delhi', 'Hyderabad', 'Pune',
  'Chennai', 'Kolkata', 'Ahmedabad', 'Jaipur', 'Surat',
  'Lucknow', 'Noida', 'Gurgaon', 'Kochi', 'Chandigarh',
]

// Keep in step with MAX_LEADS_PER_RUN in supabase/functions/_shared/pipeline.ts.
// This is the tested safe capacity, not an aspiration — see the acceptance
// matrix in LEADGENAI_EVENT_READINESS.md. The engine slices the work, so this
// bounds cost and quota rather than survival.
const MAX_PER_RUN = 50

const TERMINAL = ['completed', 'partial', 'failed', 'cancelled']

// The job reports which stage it is in and how much of each it has done. These
// are the real column values — nothing here is inferred from elapsed time, which
// is what the previous progress bar did.
const STAGE_LABEL = {
  discovering: 'Finding businesses',
  saving:      'Saving companies',
  scoring:     'AI scoring',
  finalising:  'Finishing up',
  done:        'Done',
}

// A job whose heartbeat has gone quiet has had its slice chain broken. That is
// the only way to tell it from one still working, since a killed worker cannot
// report its own death.
const STALE_MS = 90_000

export default function ScrapeModal({ onClose, onDone, quota }) {
  const [selectedCategory, setSelectedCategory] = useState('Traditional')
  const [industry, setIndustry] = useState('Real Estate')
  const [city, setCity] = useState('Bengaluru')
  const [useCustomCity, setUseCustomCity] = useState(false)
  const [customCity, setCustomCity] = useState('')
  const [limit, setLimit] = useState(10)
  const [error, setError] = useState('')
  const [overQuota, setOverQuota] = useState(false)
  const [starting, setStarting] = useState(false)

  // The job itself, as the database sees it. Everything shown while a run is in
  // flight comes from here.
  const [job, setJob] = useState(null)
  const pollRef = useRef(null)
  const nudgedRef = useRef(false)

  const running = !!job && !TERMINAL.includes(job.status)
  const finished = !!job && TERMINAL.includes(job.status)

  const handleCategoryChange = (category) => {
    setSelectedCategory(category)
    setIndustry(INDUSTRIES[category][0])
  }

  // Never let the user ask for more than the backend will allow. Two different
  // ceilings apply: the plan quota is what the customer has left, MAX_PER_RUN is
  // what one search is tested to do.
  const allowed = quota
    ? (quota.unlimited ? MAX_PER_RUN : Math.min(quota.allowed ?? 0, MAX_PER_RUN))
    : MAX_PER_RUN
  const cappedByRun = allowed === MAX_PER_RUN && (!quota || quota.unlimited || (quota.allowed ?? 0) > MAX_PER_RUN)
  const sliderMax = Math.max(allowed, 0)

  useEffect(() => {
    if (sliderMax > 0 && limit > sliderMax) setLimit(sliderMax)
  }, [sliderMax, limit])

  // --- Polling -------------------------------------------------------------
  //
  // scrape_runs already carries an RLS policy letting a user read their own
  // runs, so the browser reads job state straight from the table. No status
  // endpoint needed, and the row is the single source of truth for both the
  // progress display and the worker.
  const poll = useCallback(async (runId) => {
    const { data, error: err } = await supabase
      .from('scrape_runs').select('*').eq('id', runId).single()
    if (err || !data) return

    setJob(data)

    if (TERMINAL.includes(data.status)) {
      clearInterval(pollRef.current)
      pollRef.current = null
      // Let the parent refresh its list — leads were written progressively, so
      // there is something to show even when the job ends `partial`.
      onDone?.()
      return
    }

    // Broken chain: ask the backend to restart it. Once per job, so a genuinely
    // stuck job does not turn into a nudge loop.
    const beat = data.heartbeat_at ? new Date(data.heartbeat_at).getTime() : 0
    if (!nudgedRef.current && beat && Date.now() - beat > STALE_MS) {
      nudgedRef.current = true
      const { data: { session } } = await supabase.auth.getSession()
      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/scrape-leads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ action: 'resume', run_id: runId }),
      }).catch(() => { /* the reaper is the backstop */ })
    }
  }, [onDone])

  const watch = useCallback((runId) => {
    nudgedRef.current = false
    poll(runId)
    clearInterval(pollRef.current)
    pollRef.current = setInterval(() => poll(runId), 2500)
  }, [poll])

  // Reconnect to a job already in flight. This is what makes a refresh
  // survivable: the run lives in the database, not in this component, so
  // reloading the page rejoins it instead of losing it.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('scrape_runs')
        .select('*')
        .not('status', 'in', '("completed","partial","failed","cancelled")')
        .order('created_at', { ascending: false })
        .limit(1)
      if (cancelled || !data?.length) return
      setJob(data[0])
      watch(data[0].id)
    })()
    return () => { cancelled = true; clearInterval(pollRef.current) }
  }, [watch])

  const handleRun = async () => {
    const finalCity = useCustomCity ? customCity.trim() : city
    if (!finalCity) { setError('Please enter a city'); return }

    setError('')
    setOverQuota(false)
    setStarting(true)

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
          body: JSON.stringify({ industry, city: finalCity, sources: ['gmaps'], limit }),
        }
      )

      const body = await res.json().catch(() => null)

      if (!res.ok) {
        if (res.status === 402) {
          setOverQuota(true)
          throw new Error(body?.message || 'You have reached your plan limit for this month.')
        }
        if (res.status === 401 || body?.code === 'UNAUTHORIZED_NO_AUTH_HEADER') {
          throw new Error('Your session has expired. Please sign in again and retry.')
        }
        throw new Error(body?.message || body?.error || `Something went wrong (HTTP ${res.status}). Please try again.`)
      }

      // The call returns a job id in a couple of seconds; everything after this
      // is the worker's business and the browser only watches.
      setJob({ id: body.run_id, status: 'running', stage: 'discovering', limit_requested: limit })
      watch(body.run_id)

    } catch (err) {
      setError(err.message)
    } finally {
      setStarting(false)
    }
  }

  // --- Progress ------------------------------------------------------------
  //
  // Only fractions the job actually knows. Discovery has no incremental count —
  // Apify reports its results at the end — so that phase shows an indeterminate
  // bar rather than a number invented to fill the space.
  const saved = job?.leads_saved ?? 0
  const scored = job?.scored_count ?? 0
  const requested = job?.limit_requested ?? limit
  const stage = job?.stage || 'discovering'

  const indeterminate = running && (stage === 'discovering' || stage === 'saving')
  const pct = saved > 0 ? Math.round((scored / saved) * 100) : 0

  const detail = () => {
    if (stage === 'discovering') return `Searching for up to ${requested} businesses…`
    if (stage === 'saving') return 'Saving what was found…'
    if (stage === 'scoring') return `${scored} of ${saved} scored`
    if (stage === 'finalising') return 'Wrapping up…'
    return ''
  }

  const closeAll = () => { clearInterval(pollRef.current); onClose() }

  return (
    <div
      onClick={!running && !starting ? closeAll : undefined}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.3)',
        zIndex: 200,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
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
          // index.css centres every line in the app via `#root { text-align:
          // center }`. A form reads badly that way, and the modal inherits it.
          textAlign: 'left',
        }}
      >
        <div style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 20 }}>
          {job ? 'Lead search' : 'Run lead scrape'}
        </div>

        {/* The form is hidden once a job is in flight — the run is the subject
            of the dialog at that point, not the settings that started it. */}
        {!job && (
          <>
            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={labelStyle}>Industry Category</div>
              <select
                value={selectedCategory}
                onChange={e => handleCategoryChange(e.target.value)}
                disabled={starting}
                style={inputStyle}
              >
                {Object.keys(INDUSTRIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={labelStyle}>Industry</div>
              <select
                value={industry}
                onChange={e => setIndustry(e.target.value)}
                disabled={starting}
                style={inputStyle}
              >
                {INDUSTRIES[selectedCategory].map(i => <option key={i}>{i}</option>)}
              </select>
            </label>

            <label style={{ display: 'block', marginBottom: 14 }}>
              <div style={labelStyle}>City</div>
              {!useCustomCity ? (
                <select value={city} onChange={e => setCity(e.target.value)} disabled={starting} style={inputStyle}>
                  {INDIAN_CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input
                  type="text"
                  value={customCity}
                  onChange={e => setCustomCity(e.target.value)}
                  placeholder="Enter city name"
                  disabled={starting}
                  style={inputStyle}
                />
              )}
              <div
                onClick={() => !starting && setUseCustomCity(!useCustomCity)}
                style={{ marginTop: 6, fontSize: 12, color: T.blue, cursor: 'pointer', fontWeight: 500 }}
              >
                {useCustomCity ? '← Use dropdown' : '+ Custom city'}
              </div>
            </label>

            <div style={{ marginBottom: 14 }}>
              <div style={labelStyle}>Source</div>
              <div style={{
                marginTop: 6, padding: '8px 12px',
                background: T.blueL, borderRadius: 8,
                fontSize: 13, color: T.blue, fontWeight: 500,
              }}>
                📍 Google Maps
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <div style={{ ...labelStyle, display: 'flex', justifyContent: 'space-between' }}>
                <span>Limit</span>
                <span style={{ color: T.blue, fontWeight: 600 }}>{limit}</span>
              </div>
              <input
                type="range"
                min={Math.min(5, sliderMax)} max={sliderMax} step={sliderMax < 20 ? 1 : 5}
                value={limit}
                onChange={e => setLimit(Number(e.target.value))}
                disabled={starting || sliderMax === 0}
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
              {allowed > 0 && cappedByRun && (
                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 6, lineHeight: 1.5 }}>
                  Up to {MAX_PER_RUN} leads per search — run it again to collect more.
                </div>
              )}
            </div>
          </>
        )}

        {/* --- Live job ------------------------------------------------- */}
        {job && (
          <div style={{ marginBottom: 16 }}>
            {running && (
              <>
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
                    {STAGE_LABEL[stage] || 'Working'}…
                  </span>
                  {!indeterminate && (
                    <span style={{ color: T.muted, fontVariantNumeric: 'tabular-nums' }}>{pct}%</span>
                  )}
                </div>

                <div style={{
                  background: T.bg, border: `0.5px solid ${T.border}`,
                  borderRadius: 20, height: 8, overflow: 'hidden', position: 'relative',
                }}>
                  {indeterminate ? (
                    // No fraction exists yet, so show motion rather than a number
                    // that would be invented.
                    <div style={{
                      position: 'absolute', top: 0, bottom: 0, width: '35%',
                      background: T.blue, borderRadius: 20,
                      animation: 'lgslide 1.3s ease-in-out infinite',
                    }} />
                  ) : (
                    <div style={{
                      height: '100%', width: `${pct}%`, background: T.blue,
                      borderRadius: 20, transition: 'width 0.4s ease',
                    }} />
                  )}
                </div>

                <div style={{ fontSize: 11.5, color: T.muted, marginTop: 7, lineHeight: 1.5 }}>
                  {detail()}
                </div>

                <div style={{
                  marginTop: 10, padding: '9px 11px',
                  background: T.blueL, borderRadius: 8,
                  fontSize: 11.5, color: '#2E6B44', lineHeight: 1.5,
                }}>
                  You can close this window — the search keeps running and your
                  results are saved as they arrive.
                </div>
              </>
            )}

            {finished && <Summary job={job} />}

            {/* Real counters, whatever the state. */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
              marginTop: 12,
            }}>
              <Counter label="Requested" value={requested} />
              <Counter label="Found" value={job.discovered_count ?? 0} />
              <Counter label="Saved" value={saved} />
              <Counter label="Scored" value={scored} />
            </div>
            {(job.duplicate_count > 0 || job.failed_count > 0) && (
              <div style={{ fontSize: 11, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
                {job.duplicate_count > 0 && `${job.duplicate_count} already in your list (refreshed). `}
                {job.failed_count > 0 && `${job.failed_count} could not be scored and are saved as Unscored.`}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{
            background: T.errorL, border: `0.5px solid ${T.error}`,
            borderRadius: 8, padding: '10px 12px', fontSize: 13,
            color: T.error, marginBottom: 12, lineHeight: 1.55,
          }}>
            {error}
            {overQuota && (
              <div style={{ marginTop: 8 }}>
                <a href="/pricing" style={{
                  display: 'inline-block', padding: '5px 12px',
                  background: T.error, color: '#FFF', borderRadius: 6,
                  fontSize: 12, fontWeight: 600, textDecoration: 'none',
                }}>See plans →</a>
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={closeAll} style={secondaryBtn}>
            {running ? 'Close — keep running' : 'Close'}
          </button>
          {!job && (
            <button
              onClick={handleRun}
              disabled={starting || sliderMax === 0}
              style={{
                padding: '9px 20px',
                background: starting ? T.blueL : T.blue,
                color: starting ? T.blue : '#FFF',
                border: 'none', borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: starting ? 'not-allowed' : 'pointer',
              }}
            >
              {starting ? 'Starting…' : 'Run'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// A finished job says what actually happened. `partial` is a real outcome, not
// a failure: leads were saved, some could not be scored.
function Summary({ job }) {
  const saved = job.leads_saved ?? 0
  const dupes = job.duplicate_count ?? 0

  if (job.status === 'failed' || job.status === 'cancelled') {
    return (
      <div style={{
        background: T.errorL, border: `0.5px solid ${T.error}`, borderRadius: 8,
        padding: '10px 12px', fontSize: 12.5, color: T.error, lineHeight: 1.55,
      }}>
        {job.error_message || 'This search did not finish.'}
        {saved > 0 && ` ${saved} lead${saved === 1 ? '' : 's'} collected before it stopped ${saved === 1 ? 'is' : 'are'} saved in your list.`}
      </div>
    )
  }

  if (job.status === 'partial') {
    return (
      <div style={{
        background: T.amberL, border: `0.5px solid #E8C88A`, borderRadius: 8,
        padding: '10px 12px', fontSize: 12.5, color: T.amber, lineHeight: 1.55,
      }}>
        Saved {saved} lead{saved === 1 ? '' : 's'}. Some could not be scored by the AI
        and are marked <b>Unscored</b> — run the search again to fill them in.
      </div>
    )
  }

  return (
    <div style={{ color: T.blue, fontSize: 13, fontWeight: 600, lineHeight: 1.55 }}>
      {saved === 0
        ? dupes > 0
          ? `✓ Finished — no new leads. All ${dupes} result${dupes === 1 ? ' was' : 's were'} already in your list; details refreshed.`
          : '✓ Finished — no new leads found for this search.'
        : `✓ Added ${saved} new lead${saved === 1 ? '' : 's'}${dupes > 0 ? ` · ${dupes} already in your list, refreshed` : ''}.`}
    </div>
  )
}

function Counter({ label, value }) {
  return (
    <div style={{
      border: `0.5px solid ${T.border}`, borderRadius: 8,
      padding: '8px 9px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 9.5, color: T.muted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{value}</div>
    </div>
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

const secondaryBtn = {
  padding: '9px 18px',
  background: 'none',
  border: `0.5px solid ${T.border}`,
  borderRadius: 8,
  fontSize: 13,
  color: T.ink2,
  cursor: 'pointer',
}

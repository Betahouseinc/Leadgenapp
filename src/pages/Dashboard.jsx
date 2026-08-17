import { useState, useEffect, useCallback } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { scoreBand, HIGH_SCORE } from '../constants/score'
import ScrapeModal from '../components/ScrapeModal'

// Everything on this page is read from the database. Where the product does not
// hold the data a panel would need — named decision makers, ICP settings, a
// live schedule — the panel says so rather than showing a plausible number.

const T = {
  bg: '#F6F8F7',
  card: '#FFFFFF',
  line: '#E5EBE7',
  ink: '#151917',
  ink2: '#4B5560',
  muted: '#68726D',
  green: '#109840',
  greenD: '#0E7D40',
  soft: '#EDF8F1',
  amber: '#9B5D08',
  amberL: '#FFF4DF',
}

const NAV = [
  { key: 'dashboard',  icon: '▦', label: 'Dashboard' },
  { key: 'find',       icon: '⌕', label: 'Find Leads' },
  { key: 'leads',      icon: '☰', label: 'Leads' },
  { key: 'scoring',    icon: '◎', label: 'AI Scoring' },
  { key: 'outreach',   icon: '✦', label: 'Outreach' },
  { key: 'schedules',  icon: '◷', label: 'Scheduled Runs' },
  { key: 'integrations', icon: '↗', label: 'Integrations' },
  { key: 'settings',   icon: '⚙', label: 'Settings' },
]

const TERMINAL = ['completed', 'partial', 'failed', 'cancelled']

// Derived from the lead's own website, so it is the business's real favicon or
// nothing. No logo is invented, and a business without a website gets initials.
function CompanyMark({ name, website, size = 34 }) {
  const [failed, setFailed] = useState(false)
  let domain = ''
  try {
    if (website) domain = new URL(website.startsWith('http') ? website : `https://${website}`).hostname
  } catch { domain = '' }

  const initials = (name || '?').split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase()

  if (!domain || failed) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 7, flexShrink: 0,
        background: 'linear-gradient(135deg,#DCEBE3,#B8D9C7)',
        display: 'grid', placeItems: 'center',
        fontSize: size * 0.34, fontWeight: 800, color: '#26734A',
      }}>{initials}</div>
    )
  }
  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=64`}
      alt=""
      onError={() => setFailed(true)}
      style={{
        width: size, height: size, borderRadius: 7, flexShrink: 0,
        objectFit: 'contain', background: '#fff', border: `1px solid ${T.line}`,
      }}
    />
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [stats, setStats] = useState(null)
  const [searches, setSearches] = useState([])
  const [opps, setOpps] = useState([])
  const [bands, setBands] = useState({ high: 0, mid: 0, low: 0, unscored: 0 })
  const [activeJob, setActiveJob] = useState(null)
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  // The user's own description of what they sell. Kept locally and only ever
  // shown back to them or passed to the outreach prompt — the product has no
  // field for it, and inventing one would be worse than asking.
  const [myBusiness, setMyBusiness] = useState(() => localStorage.getItem('lg:business') || '')

  const load = useCallback(async () => {
    const [statsRes, runsRes, oppsRes, allRes] = await Promise.all([
      supabase.rpc('lead_stats'),
      supabase.from('scrape_runs')
        .select('id,industry,city,limit_requested,leads_saved,status,stage,created_at,discovered_count,scored_count,duplicate_count,failed_count,heartbeat_at,error_message')
        .order('created_at', { ascending: false }).limit(30),
      supabase.from('leads_view')
        .select('id,name,city,industry,website,score,summary,email,phone,created_at')
        .order('score', { ascending: false, nullsFirst: false })
        .limit(6),
      supabase.from('leads_view').select('score').limit(2000),
    ])

    if (statsRes.data) setStats(statsRes.data)
    if (oppsRes.data) setOpps(oppsRes.data)

    const runs = runsRes.data || []
    // A job still in flight belongs at the top of the page, not buried in
    // history — this is the same row the scrape modal polls.
    setActiveJob(runs.find(r => !TERMINAL.includes(r.status)) || null)

    // Distinct industry+city pairs, newest first. The recent_searches view this
    // would have read was never created in this database, and scrape_runs is
    // where that view got its data anyway.
    const seen = new Set()
    setSearches(runs.filter(r => {
      const k = `${r.industry}|${r.city}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    }).slice(0, 5))

    const scores = (allRes.data || []).map(r => r.score)
    setBands({
      high: scores.filter(s => s != null && s >= 80).length,
      mid: scores.filter(s => s != null && s >= 50 && s < 80).length,
      low: scores.filter(s => s != null && s < 50).length,
      unscored: scores.filter(s => s == null).length,
    })
    setLoading(false)
  }, [])

  // Session and first load happen together, inside the promise callback rather
  // than in the effect body — the dashboard has nothing to render until both
  // have resolved anyway.
  useEffect(() => {
    let cancelled = false
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return
      if (!data.session) { navigate('/login'); return }
      setSession(data.session)
      load()
    })
    return () => { cancelled = true }
  }, [navigate, load])

  // Keep the live-job card honest while a run is in flight.
  useEffect(() => {
    if (!activeJob) return
    const id = setInterval(load, 3000)
    return () => clearInterval(id)
  }, [activeJob, load])

  const go = (key) => {
    if (key === 'leads') return navigate('/leads')
    if (key === 'find') return setScrapeOpen(true)
    document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const initial = (session?.user?.email || '?')[0].toUpperCase()
  const totalScored = bands.high + bands.mid + bands.low

  return (
    <div className="lg-shell" style={{ display: 'grid', gridTemplateColumns: 'minmax(0,230px) minmax(0,1fr)', minHeight: '100vh', background: T.bg }}>
      <style>{`
        /* index.css still carries a leftover template rule —
           #root { width: 1126px; text-align: center } — which caps the app at
           1126px and centres every line of text in it. An application shell
           needs the full viewport and left-aligned copy. Scoped here rather
           than fixed globally so the existing pages keep the layout they have
           today; this style element only exists while the dashboard is mounted. */
        #root {
          width: 100% !important;
          max-width: none !important;
          text-align: left !important;
          border-inline: none !important;
        }
        @media (max-width: 1000px) {
          .lg-shell { grid-template-columns: 64px minmax(0,1fr) !important; }
          .lg-navlabel { display: none !important; }
          .lg-nav a { justify-content: center; }
          .lg-brand-full { display: none !important; }
          .lg-brand-short { display: inline !important; }
          .lg-grid2 { grid-template-columns: minmax(0,1fr) !important; }
          .lg-kpis { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .lg-int { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
        }
        /* Below this an integration card cannot fit its mark, two lines of text
           and a status side by side — the text collapses to a few pixels. One
           per row is the honest fit. */
        @media (max-width: 620px) {
          .lg-int { grid-template-columns: minmax(0,1fr) !important; }
          .lg-sched { grid-template-columns: minmax(0,1fr) !important; }
        }
      `}</style>

      {/* Sidebar */}
      <aside className="lg-nav" style={{
        background: '#121916', color: '#DFE7E2', padding: '22px 14px',
        position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box',
      }}>
        <div style={{ fontSize: 21, fontWeight: 800, padding: '0 10px 26px', color: '#fff' }}>
          <span className="lg-brand-full">Lead<span style={{ color: '#38CE78' }}>Gen</span>AI</span>
          <span className="lg-brand-short" style={{ display: 'none' }}>LG</span>
        </div>
        <nav style={{ fontSize: 13 }}>
          {NAV.map(n => (
            <a
              key={n.key}
              onClick={() => go(n.key)}
              style={{
                display: 'flex', gap: 11, alignItems: 'center',
                padding: '11px 12px', borderRadius: 8, margin: '3px 0',
                color: n.key === 'dashboard' ? '#fff' : '#AEB9B2',
                background: n.key === 'dashboard' ? T.green : 'transparent',
                cursor: 'pointer', userSelect: 'none',
              }}
            >
              <span>{n.icon}</span><span className="lg-navlabel">{n.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <main style={{ minWidth: 0 }}>
        {/* Top bar */}
        <header style={{
          height: 68, background: '#fff', borderBottom: `1px solid ${T.line}`,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 clamp(14px, 3vw, 28px)',
        }}>
          <h1 style={{ fontSize: 18, margin: 0, color: T.ink }}>Dashboard</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Link to="/leads" style={{
              border: `1px solid ${T.line}`, borderRadius: 8, padding: '8px 11px',
              fontSize: 12, color: T.ink2, textDecoration: 'none', background: '#fff',
            }}>All leads</Link>
            <div style={{
              width: 30, height: 30, borderRadius: '50%', background: '#DFF5E8',
              color: T.greenD, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13,
            }}>{initial}</div>
          </div>
        </header>

        <div style={{ maxWidth: 1320, margin: 'auto', padding: 'clamp(16px,3vw,25px) clamp(14px,3vw,28px) 45px' }}>

          {/* Greeting */}
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            alignItems: 'flex-end', marginBottom: 20, gap: 12, flexWrap: 'wrap',
          }}>
            <div>
              <h2 style={{ margin: 0, fontSize: 'clamp(20px,3vw,27px)', letterSpacing: '-0.6px', color: T.ink }}>
                Your GTM engine
              </h2>
              <p style={{ margin: '6px 0 0', color: T.muted, fontSize: 13 }}>
                {loading ? 'Loading your data…' : `${stats?.total ?? 0} leads collected · ${stats?.new_today ?? 0} added today`}
              </p>
            </div>
            <button onClick={() => setScrapeOpen(true)} style={primaryBtn}>＋ New Lead Search</button>
          </div>

          {/* Live job — only rendered when one is actually running */}
          {activeJob && <LiveJob job={activeJob} />}

          {/* KPIs */}
          <div className="lg-kpis" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 12 }}>
            <Kpi label="Qualified leads" value={stats?.total} note="All time" />
            <Kpi label="New today" value={stats?.new_today} note="Across all searches" />
            <Kpi label={`High AI score (${HIGH_SCORE}+)`} value={stats?.high_score} note="Priority outreach" />
            <Kpi label="Avg. AI score" value={stats?.avg_score} note="Across scored leads" />
            <Kpi label="In pipeline" value={stats?.engaged} note="Contacted or beyond" />
          </div>

          {/* Daily run + targeting */}
          {/* alignItems:start so each card is as tall as its own content —
              stretching leaves a large empty panel next to the taller one. */}
          <div className="lg-grid2" style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.65fr', gap: 14, marginTop: 14, alignItems: 'start' }}>
            <Card id="sec-schedules" title="Daily Lead Run" right={
              <span style={{ ...pill, background: T.amberL, color: T.amber }}>Not scheduled</span>
            }>
              <div className="lg-sched" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10 }}>
                <Box label="Next run" value="—" />
                <Box label="Last search" value={searches[0] ? `${searches[0].industry} · ${searches[0].city}` : '—'} />
                <Box label="Target" value={searches[0] ? `${searches[0].limit_requested} leads` : '—'} />
              </div>
              <p style={{ fontSize: 11.5, color: T.muted, lineHeight: 1.55, margin: '13px 0 0' }}>
                Automatic daily runs are <b>not active</b>. The nightly job is deployed but
                its scheduler extension (pg_cron) is not enabled on this project,
                so nothing triggers it. Searches you run stay available to repeat here.
              </p>
            </Card>

            <Card title="Your business → Target">
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={targetBox}>
                  <span style={tag}>YOU SELL</span>
                  <textarea
                    value={myBusiness}
                    onChange={e => { setMyBusiness(e.target.value); localStorage.setItem('lg:business', e.target.value) }}
                    placeholder="Describe what you sell — used to personalise AI outreach."
                    rows={2}
                    style={{
                      width: '100%', border: `1px solid ${T.line}`, borderRadius: 7,
                      padding: '7px 9px', fontSize: 12, color: T.ink, resize: 'vertical',
                      fontFamily: 'inherit', boxSizing: 'border-box', marginTop: 4,
                      // Explicit: index.css declares `color-scheme: light dark`,
                      // so an unstyled textarea renders on a dark field when the
                      // viewer's OS is in dark mode — unreadable against this card.
                      background: '#FFFFFF',
                    }}
                  />
                </div>
                <div style={targetBox}>
                  <span style={tag}>YOU TARGET</span>
                  <b style={{ display: 'block', fontSize: 13, color: T.ink }}>
                    {searches[0] ? searches[0].industry : 'No searches yet'}
                  </b>
                  <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.45, margin: '5px 0 0' }}>
                    {searches.length
                      ? `Based on your ${searches.length} most recent ${searches.length === 1 ? 'search' : 'searches'} · ${[...new Set(searches.map(s => s.city))].join(', ')}`
                      : 'Run a search and your target profile will appear here.'}
                  </p>
                </div>
              </div>
            </Card>
          </div>

          {/* Recent searches */}
          <Card title="Recent searches" style={{ marginTop: 14 }} right={
            <span onClick={() => setScrapeOpen(true)} style={linkStyle}>Run another</span>
          }>
            {searches.length === 0 && <Empty>No searches yet. Start one to fill this in.</Empty>}
            {searches.map((s, i) => (
              <div key={s.id} style={{
                display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) auto auto',
                gap: 12, alignItems: 'center', padding: '12px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${T.line}`, fontSize: 12,
              }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ color: T.ink }}>{s.industry} — {s.city}</b>
                  <small style={{ display: 'block', color: T.muted, marginTop: 3 }}>
                    {new Date(s.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    {' · '}{s.limit_requested} requested
                  </small>
                </div>
                <span style={{ ...pill, background: T.soft, color: T.greenD }}>{s.leads_saved ?? 0} saved</span>
                <StatusPill status={s.status} />
              </div>
            ))}
          </Card>

          {/* Opportunities + scoring */}
          {/* alignItems:start so each card is as tall as its own content —
              stretching leaves a large empty panel next to the taller one. */}
          <div className="lg-grid2" style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.65fr', gap: 14, marginTop: 14, alignItems: 'start' }}>
            <Card id="sec-outreach" title="Top opportunities" right={
              <Link to="/leads" style={linkStyle}>View all</Link>
            }>
              {opps.length === 0 && <Empty>No leads yet. Run a search to see your best prospects here.</Empty>}
              {opps.map((l, i) => (
                <Opportunity key={l.id} lead={l} first={i === 0} myBusiness={myBusiness} />
              ))}
              <div style={{
                marginTop: 12, padding: '9px 11px', background: '#F7F9F8',
                border: `1px solid ${T.line}`, borderRadius: 8,
                fontSize: 11, color: T.muted, lineHeight: 1.5,
              }}>
                These are companies, not individuals. <b>Decision-maker enrichment is coming soon</b> —
                names and job titles are not collected today, so none are shown.
              </div>
            </Card>

            <Card id="sec-scoring" title="AI score distribution">
              {totalScored + bands.unscored === 0
                ? <Empty>Nothing scored yet.</Empty>
                : (
                  <>
                    <div style={{ textAlign: 'center', margin: '4px 0 16px' }}>
                      <div style={{ fontSize: 34, fontWeight: 800, color: T.greenD, lineHeight: 1 }}>
                        {stats?.avg_score ?? '—'}
                      </div>
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 4 }}>average score</div>
                    </div>
                    <BandRow label="80–100" count={bands.high} total={totalScored} color="#0E7D40" />
                    <BandRow label="50–79" count={bands.mid} total={totalScored} color="#7BCF16" />
                    <BandRow label="0–49" count={bands.low} total={totalScored} color="#D98A16" />
                    {bands.unscored > 0 && (
                      <div style={{ fontSize: 11, color: T.muted, marginTop: 10, lineHeight: 1.5 }}>
                        {bands.unscored} lead{bands.unscored === 1 ? '' : 's'} saved but not scored —
                        re-run that search to score {bands.unscored === 1 ? 'it' : 'them'}.
                      </div>
                    )}
                  </>
                )}
            </Card>
          </div>

          {/* Integrations */}
          <Card id="sec-integrations" title="Integrations" style={{ marginTop: 14 }}>
            <div className="lg-int" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 9 }}>
              <Integration
                name="Google Gemini" sub="AI scoring · research · outreach"
                state="live" mark="G" markBg="#E8F0FE" markColor="#1A73E8"
              />
              <Integration
                name="Apify" sub="Google Maps discovery"
                state="live" mark="A" markBg="#EAF3FF" markColor="#1F6FEB"
              />
              <Integration
                name="Microsoft 365" sub="Coming soon · Microsoft Graph"
                state="soon" mark="M" markBg="#F3F2F1" markColor="#5E5E5E"
              />
              <Integration
                name="Salesforce" sub="Coming soon · CRM sync"
                state="soon" mark="S" markBg="#EAF4FB" markColor="#0D9DDA"
              />
              <Integration
                name="HubSpot" sub="Coming soon · contacts & companies"
                state="soon" mark="H" markBg="#FFF1EC" markColor="#FF7A59"
              />
              <Integration
                name="Slack" sub="Coming soon · run notifications"
                state="soon" mark="#" markBg="#F4ECF7" markColor="#611F69"
              />
              <Integration
                name="Zapier" sub="Coming soon · automation"
                state="soon" mark="Z" markBg="#FFF1EA" markColor="#FF4F00"
              />
              <Integration
                name="CSV / Excel export" sub="Available on the leads page"
                state="live" mark="⇩" markBg={T.soft} markColor={T.greenD}
              />
            </div>
            <p style={{ fontSize: 11, color: T.muted, lineHeight: 1.55, margin: '13px 0 0' }}>
              Only integrations marked <b>Live</b> are connected and making real API calls.
              Everything else is on the roadmap and is not connectable yet.
            </p>
          </Card>

          <div id="sec-settings" style={{ marginTop: 18, textAlign: 'center', color: '#8A938E', fontSize: 10.5 }}>
            LeadGenAI · your data stays yours
          </div>
        </div>
      </main>

      {scrapeOpen && (
        <ScrapeModal
          onClose={() => setScrapeOpen(false)}
          onDone={load}
          quota={null}
        />
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Live job card — the same scrape_runs row the modal polls
// --------------------------------------------------------------------------

const STAGE_LABEL = {
  discovering: 'Finding businesses',
  saving: 'Saving companies',
  scoring: 'AI scoring',
  finalising: 'Finishing up',
}

function LiveJob({ job }) {
  const saved = job.leads_saved ?? 0
  const scored = job.scored_count ?? 0
  const pct = saved > 0 ? Math.round((scored / saved) * 100) : 0
  const indeterminate = job.stage === 'discovering' || job.stage === 'saving'

  return (
    <div style={{
      background: '#fff', border: `1px solid ${T.green}`, borderRadius: 12,
      padding: 18, marginBottom: 14,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 700, color: T.ink }}>
          <span style={{
            width: 11, height: 11, borderRadius: '50%',
            border: `2px solid ${T.green}`, borderTopColor: 'transparent',
            display: 'inline-block', animation: 'lgspin 0.7s linear infinite',
          }} />
          {STAGE_LABEL[job.stage] || 'Working'}… — {job.industry} in {job.city}
        </div>
        <span style={{ fontSize: 11.5, color: T.muted }}>
          {indeterminate ? `up to ${job.limit_requested} requested` : `${scored} of ${saved} scored`}
        </span>
      </div>

      <div style={{ background: '#F1F5F3', borderRadius: 20, height: 8, overflow: 'hidden', position: 'relative' }}>
        {indeterminate
          ? <div style={{
              position: 'absolute', top: 0, bottom: 0, width: '35%',
              background: T.green, borderRadius: 20, animation: 'lgslide 1.3s ease-in-out infinite',
            }} />
          : <div style={{ height: '100%', width: `${pct}%`, background: T.green, borderRadius: 20, transition: 'width .4s' }} />}
      </div>

      <div style={{ fontSize: 11, color: T.muted, marginTop: 9, lineHeight: 1.5 }}>
        Results are saved as they arrive — you can leave this page and come back.
      </div>
    </div>
  )
}

// --------------------------------------------------------------------------
// Opportunity row, with real Gemini actions
// --------------------------------------------------------------------------

function Opportunity({ lead, first, myBusiness }) {
  const [busy, setBusy] = useState('')
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState('')
  const band = lead.score != null ? scoreBand(lead.score) : null

  const ask = async (kind) => {
    setBusy(kind); setErr(''); setDraft(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/draft-outreach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ lead_id: lead.id, kind, sender_business: myBusiness }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.message || 'The AI could not respond just now.')
      setDraft(body)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
    }
  }

  return (
    <div style={{ padding: '12px 0', borderTop: first ? 'none' : `1px solid ${T.line}` }}>
      <div style={{ display: 'grid', gridTemplateColumns: '34px minmax(0,1fr) auto', gap: 10, alignItems: 'center' }}>
        <CompanyMark name={lead.name} website={lead.website} />
        <div style={{ minWidth: 0 }}>
          <b style={{ fontSize: 12.5, color: T.ink }}>{lead.name}</b>
          <small style={{ display: 'block', color: T.muted, fontSize: 10.5, marginTop: 3 }}>
            {[lead.industry, lead.city].filter(Boolean).join(' · ')}
            {lead.summary ? ` — ${lead.summary}` : ''}
          </small>
        </div>
        {band
          ? <span style={{ ...pill, background: T.soft, color: band.color, fontWeight: 800 }}>{lead.score}</span>
          : <span style={{ ...pill, background: '#F0F0F0', color: T.muted }}>Unscored</span>}
      </div>

      <div style={{ display: 'flex', gap: 7, marginTop: 9, flexWrap: 'wrap' }}>
        <button onClick={() => ask('research')} disabled={!!busy} style={miniBtn}>
          {busy === 'research' ? 'Researching…' : '✦ Research with Gemini'}
        </button>
        <button onClick={() => ask('outreach')} disabled={!!busy} style={{ ...miniBtn, background: T.green, color: '#fff', borderColor: T.green }}>
          {busy === 'outreach' ? 'Drafting…' : '✉ Draft outreach'}
        </button>
      </div>

      {err && (
        <div style={{ marginTop: 8, fontSize: 11, color: '#C44B4B', lineHeight: 1.5 }}>{err}</div>
      )}

      {draft && (
        <div style={{
          marginTop: 9, border: `1px solid ${T.line}`, borderRadius: 8,
          padding: 11, background: '#FBFCFB',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 7 }}>
            <span style={{ ...pill, background: T.soft, color: T.greenD, fontSize: 9.5 }}>
              {draft.kind === 'research' ? 'GEMINI RESEARCH' : 'AI DRAFT'} · {draft.model}
            </span>
            <button
              onClick={() => navigator.clipboard?.writeText(
                (draft.subject ? `Subject: ${draft.subject}\n\n` : '') + draft.body
              )}
              style={{ ...miniBtn, padding: '4px 8px', fontSize: 10 }}
            >Copy</button>
          </div>
          {draft.subject && (
            <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink, marginBottom: 5 }}>
              {draft.subject}
            </div>
          )}
          <div style={{ fontSize: 11.5, color: '#4F5954', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
            {draft.body}
          </div>
          <div style={{ fontSize: 10, color: T.muted, marginTop: 8, lineHeight: 1.5 }}>
            Draft only — nothing is sent. Copy it into your own mail client to send.
          </div>
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------------------
// Small pieces
// --------------------------------------------------------------------------

function Card({ title, right, children, style, id }) {
  return (
    <section id={id} style={{
      background: T.card, border: `1px solid ${T.line}`, borderRadius: 12,
      padding: 18, minWidth: 0, ...style,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 }}>
        <h3 style={{ fontSize: 14, margin: 0, color: T.ink }}>{title}</h3>
        {right}
      </div>
      {children}
    </section>
  )
}

function Kpi({ label, value, note }) {
  return (
    <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 11, padding: 17, minWidth: 0 }}>
      <small style={{ color: T.muted, fontSize: 11 }}>{label}</small>
      <strong style={{ display: 'block', fontSize: 25, marginTop: 8, color: T.ink }}>
        {typeof value === 'number' ? value.toLocaleString('en-IN') : '—'}
      </strong>
      <div style={{ fontSize: 10, color: T.greenD, marginTop: 5 }}>{note}</div>
    </div>
  )
}

function Box({ label, value }) {
  return (
    <div style={{ border: `1px solid ${T.line}`, borderRadius: 9, padding: 12, background: '#FBFCFB', minWidth: 0 }}>
      <small style={{ display: 'block', color: T.muted, fontSize: 10, marginBottom: 6 }}>{label}</small>
      <b style={{ fontSize: 12.5, color: T.ink, wordBreak: 'break-word' }}>{value}</b>
    </div>
  )
}

function BandRow({ label, count, total, color }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: T.ink2, marginBottom: 4 }}>
        <span>{label}</span><span>{count}</span>
      </div>
      <div style={{ background: '#F1F5F3', borderRadius: 20, height: 6, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 20 }} />
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    completed: { bg: T.soft, fg: T.greenD, label: 'Completed' },
    partial:   { bg: T.amberL, fg: T.amber, label: 'Partial' },
    failed:    { bg: '#FDEAEA', fg: '#C44B4B', label: 'Failed' },
    cancelled: { bg: '#F0F0F0', fg: T.muted, label: 'Cancelled' },
    running:   { bg: '#E8F0FE', fg: '#1A73E8', label: 'Running' },
    queued:    { bg: '#E8F0FE', fg: '#1A73E8', label: 'Queued' },
  }
  const m = map[status] || { bg: '#F0F0F0', fg: T.muted, label: status || '—' }
  return <span style={{ ...pill, background: m.bg, color: m.fg }}>{m.label}</span>
}

function Integration({ name, sub, state, mark, markBg, markColor }) {
  const live = state === 'live'
  return (
    <div style={{
      border: `1px solid ${T.line}`, borderRadius: 9, padding: 12,
      display: 'flex', alignItems: 'center', gap: 9, minWidth: 0,
      background: live ? '#fff' : '#FCFDFC',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, display: 'grid', placeItems: 'center',
        fontSize: 11, fontWeight: 900, background: markBg, color: markColor, flexShrink: 0,
      }}>{mark}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <b style={{ fontSize: 11, color: T.ink, display: 'block' }}>{name}</b>
        <small style={{ display: 'block', color: T.muted, fontSize: 9, marginTop: 2 }}>{sub}</small>
      </div>
      <span style={{
        fontSize: 9, fontWeight: 800, flexShrink: 0,
        color: live ? T.greenD : T.muted,
      }}>{live ? '● Live' : 'Soon'}</span>
    </div>
  )
}

function Empty({ children }) {
  return <div style={{ fontSize: 12, color: T.muted, padding: '8px 0', lineHeight: 1.55 }}>{children}</div>
}

const pill = {
  display: 'inline-block', borderRadius: 99, padding: '4px 8px',
  fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
}

const tag = {
  display: 'inline-block', background: T.soft, color: T.greenD,
  fontSize: 9.5, fontWeight: 800, padding: '4px 7px',
  borderRadius: 99, marginBottom: 8,
}

const targetBox = { border: `1px solid ${T.line}`, borderRadius: 9, padding: 13, minWidth: 0 }

const primaryBtn = {
  background: T.green, border: `1px solid ${T.green}`, color: '#fff',
  borderRadius: 8, padding: '10px 14px', fontWeight: 700, fontSize: 12, cursor: 'pointer',
}

const miniBtn = {
  border: `1px solid ${T.line}`, background: '#fff', borderRadius: 7,
  padding: '6px 10px', fontSize: 11, color: T.ink2, cursor: 'pointer', fontWeight: 600,
}

const linkStyle = { fontSize: 11, color: T.greenD, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' }

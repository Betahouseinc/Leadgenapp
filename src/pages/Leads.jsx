import { useState, useEffect, useCallback, Fragment } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LEAD_STATUSES, normaliseStatus, statusMeta } from '../constants/leadStatus'
import { scoreBand } from '../constants/score'
import { INDUSTRY_FILTER_OPTIONS } from '../constants/industries'
import { exportCsv, exportExcel } from '../utils/exportLeads'
import StatsBar from '../components/StatsBar'
import LeadDrawer from '../components/LeadDrawer'
import ScrapeModal from '../components/ScrapeModal'

const T = {
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  border: 'rgba(11,13,12,0.12)',
  ink: '#0B0D0C',
  ink2: '#4B5560',
  muted: '#6B7280',
  blue: '#109840',
  blueL: '#EFF8F1',
  teal: '#7BCF16',
}

const SOURCES = ['All', 'Google Maps']
const SORTS = [
  { value: 'newest',      label: 'Newest first',  col: 'created_at', asc: false },
  { value: 'oldest',      label: 'Oldest first',  col: 'created_at', asc: true },
  { value: 'score_desc',  label: 'Highest score', col: 'score',      asc: false },
  { value: 'score_asc',   label: 'Lowest score',  col: 'score',      asc: true },
  { value: 'name_asc',    label: 'Name A-Z',      col: 'name',       asc: true },
]

const PAGE_SIZE = 50

// Exports still need every matching row, not just the visible page, so they
// page through server-side. 1000 is Supabase's per-request ceiling.
const EXPORT_PAGE = 1000

// PostgREST's or() filter is comma-delimited, so these characters would be read
// as syntax rather than as part of the search term.
function sanitiseSearch(q) {
  return q.replace(/[,()%\\]/g, ' ').trim()
}

function relativeTime(v) {
  if (!v) return null
  const then = new Date(v)
  if (Number.isNaN(then.getTime())) return null
  const days = Math.floor((Date.now() - then.getTime()) / 86400000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} mo ago`
  return `${Math.floor(months / 12)} yr ago`
}

function sourceBadge(source) {
  const isGmaps = source === 'gmaps' || source === 'Google Maps'
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 9px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: isGmaps ? '#E8F5E9' : '#E6F4EA',
      color: isGmaps ? '#2E7D32' : '#087A32',
      whiteSpace: 'nowrap',
    }}>
      {isGmaps ? 'GMaps' : 'LinkedIn'}
    </span>
  )
}

function ScoreBar({ score }) {
  // A null score means AI scoring never ran for this lead. Rendering it as 0
  // would read as "terrible lead" rather than "no data", which is the exact
  // confusion the old hardcoded 40 created.
  if (score == null) {
    return (
      <span
        title="This lead was saved before it could be scored. Re-run the search to score it."
        style={{
          fontSize: 11, fontWeight: 600, color: T.muted,
          background: 'rgba(0,0,0,0.05)', borderRadius: 20,
          padding: '2px 9px', whiteSpace: 'nowrap',
        }}
      >Unscored</span>
    )
  }

  const { color } = scoreBand(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 48, height: 5, borderRadius: 4,
        background: 'rgba(0,0,0,0.08)', overflow: 'hidden',
      }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 4 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color }}>{score}</span>
    </div>
  )
}

export default function Leads() {
  const navigate = useNavigate()
  const [leads, setLeads] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(new Set())
  const [drawer, setDrawer] = useState(null)
  const [scrapeOpen, setScrapeOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [page, setPage] = useState(0)
  const [total, setTotal] = useState(0)
  const [stats, setStats] = useState(null)
  const [industry, setIndustry] = useState('All')
  const [source, setSource] = useState('All')
  const [minScore, setMinScore] = useState(0)
  const [status, setStatus] = useState('All')
  const [sort, setSort] = useState('newest')
  const [profile, setProfile] = useState(null)
  const [quota, setQuota] = useState(null)
  const [notesOpen, setNotesOpen] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteMsg, setNoteMsg] = useState(null)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(null)

  // Usage is read from the same RPC the edge function enforces with, so the
  // meter can never disagree with what the backend actually allows.
  const refreshQuota = useCallback(async (userId) => {
    const id = userId || (await supabase.auth.getSession()).data.session?.user?.id
    if (!id) return
    const { data } = await supabase.rpc('check_lead_quota', { p_user_id: id })
    if (data) setQuota(data)
  }, [])

  // Auth guard + load profile
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('*, plans(*)')
        .eq('id', session.user.id)
        .single()
      if (data) setProfile({ ...data, email: data.email || session.user.email })

      refreshQuota(session.user.id)
    })
  }, [navigate, refreshQuota])

  // Every filter is applied by Postgres. Previously the page downloaded the
  // whole table and filtered in JavaScript, which cost one round trip per 1000
  // rows on every render and does not survive a few thousand leads.
  const buildQuery = useCallback((select, opts) => {
    const s = SORTS.find(x => x.value === sort) || SORTS[0]
    // Reads go through leads_view, which masks email and phone for free-plan
    // users. Writes still target `leads` directly — the view is read-only.
    let q = supabase.from('leads_view').select(select, opts)

    if (status !== 'All') q = q.eq('status', status)
    if (industry !== 'All') q = q.eq('industry', industry)
    if (source === 'Google Maps') q = q.in('source', ['gmaps', 'Google Maps'])
    else if (source === 'LinkedIn') q = q.in('source', ['linkedin', 'LinkedIn'])

    // Only constrain the score when the user actually asked for a floor. A bare
    // `score >= 0` is NULL for unscored leads, which would silently hide them.
    if (minScore > 0) q = q.gte('score', minScore)

    const term = sanitiseSearch(debouncedSearch)
    if (term) q = q.or(`name.ilike.%${term}%,email.ilike.%${term}%`)

    return q.order(s.col, { ascending: s.asc, nullsFirst: false })
  }, [status, sort, industry, source, minScore, debouncedSearch])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const from = page * PAGE_SIZE
      const { data, count, error: e } = await buildQuery('*', { count: 'exact' })
        .range(from, from + PAGE_SIZE - 1)
      if (e) throw e
      setLeads(data || [])
      setTotal(count ?? 0)
    } catch (e) {
      setError(e.message || 'Could not load leads. Please refresh.')
      setLeads([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [buildQuery, page])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  // Aggregates come from the database now — the client only holds one page and
  // could not compute totals over the full set.
  const refreshStats = useCallback(async () => {
    const { data } = await supabase.rpc('lead_stats')
    if (data && !data.error) setStats(data)
  }, [])

  useEffect(() => { refreshStats() }, [refreshStats])

  // Typing must not fire a query per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(id)
  }, [search])

  // Any filter change invalidates the current page number.
  useEffect(() => {
    setPage(0)
  }, [status, industry, source, minScore, debouncedSearch, sort])

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // Drives the empty state: "no leads yet" and "no leads match your filters"
  // need different wording and different buttons.
  const hasActiveFilters =
    search !== '' || industry !== 'All' || source !== 'All' || status !== 'All' || minScore > 0

  const clearFilters = () => {
    setSearch('')
    setIndustry('All')
    setSource('All')
    setStatus('All')
    setMinScore(0)
  }

  // Selection is per-page: "select all" cannot mean 40,000 unseen rows.
  const allOnPageSelected = leads.length > 0 && leads.every(l => selected.has(l.id))
  const toggleAll = () => {
    setSelected(prev => {
      const next = new Set(prev)
      if (allOnPageSelected) leads.forEach(l => next.delete(l.id))
      else leads.forEach(l => next.add(l.id))
      return next
    })
  }

  const toggleRow = (id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const applyStatus = async (ids, next) => {
    setError(null)
    const { error: e } = await supabase.from('leads').update({ status: next }).in('id', ids)
    if (e) { setError(`Could not update status: ${e.message}`); return }
    // last_contacted_at is stamped by a DB trigger, so re-read to reflect it.
    const { data } = await supabase.from('leads_view').select('*').in('id', ids)
    const byId = Object.fromEntries((data || []).map(r => [r.id, r]))
    setLeads(prev => prev.map(l => byId[l.id] ? byId[l.id] : l))
  }

  const updateStatus = (ids, next) => applyStatus(ids, next)
  const updateRowStatus = (id, next) => applyStatus([id], next)

  const openNotes = (lead) => {
    if (notesOpen === lead.id) { setNotesOpen(null); return }
    setNotesOpen(lead.id)
    setNoteDraft(lead.notes || '')
    setNoteMsg(null)
  }

  const saveNote = async (id) => {
    if (noteSaving) return
    setNoteSaving(true)
    setNoteMsg(null)
    const { error: e } = await supabase.from('leads').update({ notes: noteDraft }).eq('id', id)
    setNoteSaving(false)
    if (e) { setNoteMsg({ ok: false, text: `Not saved: ${e.message}` }); return }
    setLeads(prev => prev.map(l => l.id === id ? { ...l, notes: noteDraft } : l))
    setNoteMsg({ ok: true, text: 'Saved' })
    setTimeout(() => setNoteMsg(null), 2000)
  }

  // Exports cover every row matching the current filters, not just the visible
  // page, so they fetch server-side rather than reading component state.
  const fetchAllMatching = useCallback(async () => {
    const out = []
    for (let from = 0; ; from += EXPORT_PAGE) {
      const { data, error: e } = await buildQuery('*').range(from, from + EXPORT_PAGE - 1)
      if (e) throw e
      out.push(...(data || []))
      if (!data || data.length < EXPORT_PAGE) break
    }
    return out
  }, [buildQuery])

  const runExport = async (kind, scope) => {
    setError(null)
    setExporting(kind)
    try {
      let rows
      if (scope === 'selected') {
        // Selections can span pages, so read them from the database by id
        // rather than from the rows that happen to be on screen.
        const ids = Array.from(selected)
        const { data, error: e } = await supabase.from('leads_view').select('*').in('id', ids)
        if (e) throw e
        rows = data || []
      } else {
        rows = await fetchAllMatching()
      }
      if (!rows.length) { setError('Nothing to export.'); return }
      kind === 'csv' ? exportCsv(rows) : exportExcel(rows)
    } catch (e) {
      setError(`Export failed: ${e.message}`)
    } finally {
      setExporting(null)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const selectedIds = Array.from(selected)

  return (
    <div style={{
      minHeight: '100vh',
      background: T.bg,
      fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      color: T.ink,
      overflowX: 'hidden',
    }}>
      <style>{`
        @media (max-width: 500px) {
          .lg-quota-detail { display: none !important; }
          .lg-quota-bar { display: none !important; }
          .lg-username { display: none !important; }
          .lg-run-btn span.lg-run-full { display: none !important; }
          .lg-run-btn span.lg-run-short { display: inline !important; }
          .lg-filter-bar { flex-direction: column !important; }
          .lg-filter-row1 { width: 100% !important; }
          .lg-filter-row2 { width: 100% !important; }
        }
        @media (min-width: 501px) {
          .lg-run-btn span.lg-run-short { display: none !important; }
          .lg-run-btn span.lg-run-full { display: inline !important; }
        }
      `}</style>
      {/* Top bar */}
      <div style={{
        background: T.surface,
        borderBottom: `0.5px solid ${T.border}`,
        padding: '8px clamp(12px, 3vw, 24px)',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        {/* Row 1: logo + action buttons */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 800, color: T.blue, letterSpacing: '-0.5px', flexShrink: 0 }}>
            LeadGen
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
          {/* Upgrade pill — compact, always visible if not unlimited */}
          {quota && (!quota.unlimited || quota.day_remaining === 0) && (
            <Link to="/pricing" style={{
              padding: '4px 10px',
              background: quota.allowed === 0 ? T.blue : T.blueL,
              color: quota.allowed === 0 ? '#FFF' : T.blue,
              border: `0.5px solid ${T.blue}`,
              borderRadius: 20, fontSize: 11, fontWeight: 600,
              textDecoration: 'none', whiteSpace: 'nowrap',
            }}>Upgrade</Link>
          )}

          {profile && (
            <div title={profile.email} style={{ flexShrink: 0 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: T.blue, color: '#FFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700,
              }}>
                {(profile.full_name || profile.email || '?').trim().charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          {/* The dashboard had no entry point anywhere in the app — it was
              routed and reachable only by typing the URL. */}
          <Link
            to="/dashboard"
            style={{
              padding: '6px 12px',
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              color: T.ink2,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >Dashboard</Link>
          <button
            className='lg-run-btn'
            onClick={() => setScrapeOpen(true)}
            style={{
              padding: '6px 14px',
              background: T.blue,
              color: '#FFF',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              flexShrink: 0,
            }}
          ><span className='lg-run-full'>+ Run scrape</span><span className='lg-run-short'>+</span></button>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 10px', background: '#FFF',
              border: `0.5px solid ${T.border}`, borderRadius: 8,
              fontSize: 12, color: T.ink2, cursor: 'pointer', flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >Log Out</button>
          </div>
        </div>
        {/* Row 2: quota meter — full width, only shown on mobile */}
        {quota && (
          <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ flex: 1, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                background: quota.allowed === 0 ? '#B91C1C' : quota.allowed <= 5 ? '#B45309' : T.blue,
                width: (() => {
                  const monthPct = quota.unlimited ? 0 : (quota.used / Math.max(quota.limit, 1)) * 100
                  const dayPct = quota.day_limit ? (quota.day_used / Math.max(quota.day_limit, 1)) * 100 : 0
                  return `${Math.max(4, Math.min(100, Math.max(monthPct, dayPct)))}%`
                })(),
              }} />
            </div>
            <span style={{ fontSize: 11, color: T.muted, whiteSpace: 'nowrap' }}>
              {quota.used}/{quota.unlimited ? '∞' : quota.limit} · <span style={{ color: T.blue, fontWeight: 600 }}>{profile?.plans?.name || quota.plan}</span>
            </span>
          </div>
        )}
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(12px, 3vw, 24px) clamp(12px, 3vw, 24px) 80px' }}>
        <StatsBar stats={stats} />

        {/* Filter bar */}
        <div style={{
          display: 'flex',
          gap: 10,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 16,
          background: T.surface,
          border: `0.5px solid ${T.border}`,
          borderRadius: 8,
          padding: '12px 16px',
        }}>
          <input
            type="search"
            placeholder="Search name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              padding: '7px 11px',
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: T.ink,
              background: T.bg,
              outline: 'none',
              width: 'clamp(140px, 30vw, 220px)',
            }}
          />
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            style={selectStyle}
          >
            {INDUSTRY_FILTER_OPTIONS.map(i => <option key={i}>{i}</option>)}
          </select>

          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={selectStyle}
            aria-label="Filter by status"
          >
            <option value="All">All statuses</option>
            {LEAD_STATUSES.map(st => (
              <option key={st.value} value={st.value}>{st.label}</option>
            ))}
          </select>

          {/* Source pills */}
          <div style={{ display: 'flex', gap: 6 }}>
            {SOURCES.map(s => (
              <button
                key={s}
                onClick={() => setSource(s)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 500,
                  border: `0.5px solid ${source === s ? T.blue : T.border}`,
                  background: source === s ? T.blueL : T.bg,
                  color: source === s ? T.blue : T.ink2,
                  cursor: 'pointer',
                }}
              >{s}</button>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, color: T.muted }}>Min score: {minScore}</span>
              <input
                type="range"
                min={0} max={100} step={5}
                value={minScore}
                onChange={e => setMinScore(Number(e.target.value))}
                style={{ accentColor: T.blue, width: 90 }}
              />
            </div>
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={selectStyle}
              aria-label="Sort leads"
            >
              {SORTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        {error && (
          <div style={{
            marginBottom: 12, padding: '10px 14px', borderRadius: 8,
            background: '#FEE2E2', border: '0.5px solid rgba(185,28,28,0.25)',
            color: '#B91C1C', fontSize: 13,
          }}>{error}</div>
        )}

        {/* Contacts are masked by the database for free plans; this only
            explains why. Removing it would not reveal anything. */}
        {leads.length > 0 && leads[0].contacts_masked && (
          <div style={{
            marginBottom: 12, padding: '10px 14px', borderRadius: 8,
            background: T.blueL, border: `0.5px solid ${T.blue}`,
            fontSize: 12.5, color: T.blue, lineHeight: 1.6,
          }}>
            Email and phone are partially hidden on the free plan.{' '}
            <Link to="/pricing" style={{ color: T.blue, fontWeight: 700 }}>
              Upgrade to reveal full contact details →
            </Link>
          </div>
        )}

        {/* Export all filtered — visible when nothing is hand-selected */}
        {!loading && selected.size === 0 && total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginBottom: 12, padding: '10px 14px',
            background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, color: T.ink2 }}>
              Export all {total.toLocaleString('en-IN')} result{total === 1 ? '' : 's'}
            </span>
            <button onClick={() => runExport('csv', 'all')} disabled={!!exporting} style={ghostBtn}>
              {exporting === 'csv' ? 'Preparing…' : 'CSV'}
            </button>
            <button onClick={() => runExport('xlsx', 'all')} disabled={!!exporting} style={ghostBtn}>
              {exporting === 'xlsx' ? 'Preparing…' : 'Excel'}
            </button>
            <span style={{ fontSize: 11, color: T.muted, marginLeft: 'auto' }}>
              Tick rows to export a subset
            </span>
          </div>
        )}

        {/* Table */}
        <div style={{
          background: T.surface,
          border: `0.5px solid ${T.border}`,
          borderRadius: 8,
          overflow: 'auto',
        }}>
          {loading ? (
            <TableSkeleton />
          ) : leads.length === 0 ? (
            <EmptyState
              filtered={hasActiveFilters}
              onClear={clearFilters}
              onScrape={() => setScrapeOpen(true)}
            />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                  <Th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={allOnPageSelected}
                      onChange={toggleAll}
                      title="Select all on this page"
                      style={{ accentColor: T.blue }}
                    />
                  </Th>
                  <Th>Name / Company</Th>
                  <Th>Email / Phone</Th>
                  <Th>Industry</Th>
                  <Th>Source</Th>
                  <Th>Score</Th>
                  <Th>City</Th>
                  <Th>Status</Th>
                  <Th>Last contacted</Th>
                  <Th style={{ width: 44 }}>Notes</Th>
                  <Th>Date Added</Th>
                </tr>
              </thead>
              <tbody>
                {leads.map(lead => (
                  <Fragment key={lead.id}>
                  <tr
                    onClick={() => setDrawer(lead)}
                    style={{
                      borderBottom: `0.5px solid ${T.border}`,
                      cursor: 'pointer',
                      background: selected.has(lead.id) ? T.blueL : 'transparent',
                    }}
                    onMouseEnter={e => { if (!selected.has(lead.id)) e.currentTarget.style.background = T.bg }}
                    onMouseLeave={e => { e.currentTarget.style.background = selected.has(lead.id) ? T.blueL : 'transparent' }}
                  >
                    <Td onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(lead.id)}
                        onChange={() => toggleRow(lead.id)}
                        style={{ accentColor: T.blue }}
                      />
                    </Td>
                    <Td>
                      <div style={{ fontWeight: 600, color: T.ink }}>{lead.name || '—'}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{lead.company || ''}</div>
                    </Td>
                    <Td>
                      <div style={{ color: T.ink }}>{lead.email || '—'}</div>
                      <div style={{ color: T.muted, fontSize: 11 }}>{lead.phone || ''}</div>
                    </Td>
                    <Td>{lead.industry || '—'}</Td>
                    <Td>{sourceBadge(lead.source)}</Td>
                    <Td><ScoreBar score={lead.score ?? null} /></Td>
                    <Td>{lead.city || '—'}</Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <select
                        value={normaliseStatus(lead.status)}
                        onChange={e => updateRowStatus(lead.id, e.target.value)}
                        style={{
                          padding: '3px 7px',
                          border: `0.5px solid ${T.border}`,
                          borderRadius: 6,
                          fontSize: 12,
                          background: statusMeta(lead.status).bg,
                          color: statusMeta(lead.status).color,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {LEAD_STATUSES.map(st => (
                          <option key={st.value} value={st.value}>{st.label}</option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <span style={{ color: lead.last_contacted_at ? T.ink2 : T.muted, fontSize: 12 }}>
                        {relativeTime(lead.last_contacted_at) || '—'}
                      </span>
                    </Td>
                    <Td onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => openNotes(lead)}
                        title={lead.notes ? 'Edit notes' : 'Add notes'}
                        style={{
                          border: `0.5px solid ${lead.notes ? T.blue : T.border}`,
                          background: lead.notes ? T.blueL : 'transparent',
                          color: lead.notes ? T.blue : T.muted,
                          borderRadius: 6, cursor: 'pointer',
                          padding: '3px 8px', fontSize: 12, fontWeight: 600, lineHeight: 1.4,
                        }}
                      >{lead.notes ? '✎' : '+'}</button>
                    </Td>
                    {/* Was previously outside the <tr>, which detached it from
                        its row and left the Date Added column unpopulated. */}
                    <Td>
                      <span style={{ fontSize: 11.5, color: T.muted, whiteSpace: 'nowrap' }}>
                        {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' }) : '—'}
                      </span>
                    </Td>
                  </tr>
                  {notesOpen === lead.id && (
                    <tr>
                      <td colSpan={11} style={{ padding: '0 14px 14px', background: T.bg }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          <textarea
                            value={noteDraft}
                            onChange={e => setNoteDraft(e.target.value)}
                            onClick={e => e.stopPropagation()}
                            placeholder={`Notes on ${lead.name || 'this lead'} — call outcomes, follow-up dates, context…`}
                            rows={3}
                            style={{
                              width: '100%', boxSizing: 'border-box', resize: 'vertical',
                              padding: '9px 11px', fontSize: 13, lineHeight: 1.5,
                              fontFamily: 'inherit', color: T.ink, background: T.surface,
                              border: `0.5px solid ${T.border}`, borderRadius: 8, outline: 'none',
                            }}
                          />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <button
                              onClick={e => { e.stopPropagation(); saveNote(lead.id) }}
                              disabled={noteSaving}
                              style={{
                                padding: '6px 14px', background: T.blue, color: '#FFF',
                                border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600,
                                cursor: noteSaving ? 'wait' : 'pointer', opacity: noteSaving ? 0.7 : 1,
                              }}
                            >{noteSaving ? 'Saving…' : 'Save notes'}</button>
                            <button
                              onClick={e => { e.stopPropagation(); setNotesOpen(null) }}
                              style={{
                                padding: '6px 12px', background: 'none',
                                border: `0.5px solid ${T.border}`, borderRadius: 8,
                                fontSize: 12, color: T.ink2, cursor: 'pointer',
                              }}
                            >Close</button>
                            {noteMsg && (
                              <span style={{ fontSize: 12, color: noteMsg.ok ? T.teal : '#B91C1C' }}>
                                {noteMsg.text}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pager */}
        {!loading && total > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginTop: 12, padding: '10px 14px',
            background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 12.5, color: T.ink2 }}>
              {(page * PAGE_SIZE + 1).toLocaleString('en-IN')}–
              {Math.min((page + 1) * PAGE_SIZE, total).toLocaleString('en-IN')}
              {' of '}{total.toLocaleString('en-IN')}
            </span>
            <div style={{ display: 'flex', gap: 6, marginLeft: 'auto', alignItems: 'center' }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ ...pagerBtn, opacity: page === 0 ? 0.4 : 1, cursor: page === 0 ? 'default' : 'pointer' }}
              >← Prev</button>
              <span style={{ fontSize: 12.5, color: T.muted, padding: '0 4px' }}>
                Page {page + 1} of {pageCount.toLocaleString('en-IN')}
              </span>
              <button
                onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))}
                disabled={page >= pageCount - 1}
                style={{ ...pagerBtn, opacity: page >= pageCount - 1 ? 0.4 : 1, cursor: page >= pageCount - 1 ? 'default' : 'pointer' }}
              >Next →</button>
            </div>
          </div>
        )}

        {/* Where the data comes from — disclosed in-product, not only in the
            legal pages, because this is where the data is actually used. */}
        <div style={{
          marginTop: 12, fontSize: 11.5, color: T.muted, lineHeight: 1.6,
        }}>
          Leads are compiled from publicly listed business information on Google Maps and
          scored by an AI model. Details may be outdated or incomplete — verify before
          acting on them. You are responsible for the lawfulness of your outreach.{' '}
          <Link to="/legal/privacy" style={{ color: T.blue, textDecoration: 'none' }}>
            Privacy Policy
          </Link>
          {' · '}
          <Link to="/legal/terms" style={{ color: T.blue, textDecoration: 'none' }}>
            Terms
          </Link>
        </div>

        {/* FAQ Section */}
        <FAQ />
      </div>

      {/* Bottom action bar */}
      {selected.size > 0 && (
        <div style={{
          position: 'fixed',
          bottom: 0, left: 0, right: 0,
          background: T.surface,
          borderTop: `0.5px solid ${T.border}`,
          padding: '12px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          zIndex: 50,
        }}>
          <span style={{ fontSize: 13, color: T.ink2, marginRight: 4 }}>
            {selected.size} selected
          </span>
          <ActionBtn onClick={() => updateStatus(selectedIds, 'contacted')}>Mark contacted</ActionBtn>
          <ActionBtn onClick={() => updateStatus(selectedIds, 'follow_up')} accent="#B45309">Follow-up</ActionBtn>
          <ActionBtn onClick={() => updateStatus(selectedIds, 'qualified')} accent={T.teal}>Mark qualified</ActionBtn>
          <ActionBtn onClick={() => runExport('csv', 'selected')}>Export CSV</ActionBtn>
          <ActionBtn onClick={() => runExport('xlsx', 'selected')}>Export Excel</ActionBtn>
          <button
            onClick={() => setSelected(new Set())}
            style={{
              marginLeft: 'auto',
              padding: '6px 12px',
              background: 'none',
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 12,
              color: T.muted,
              cursor: 'pointer',
            }}
          >Clear</button>
        </div>
      )}

      {drawer && <LeadDrawer lead={drawer} onClose={() => setDrawer(null)} />}
      {scrapeOpen && (
        <ScrapeModal
          quota={quota}
          onClose={() => setScrapeOpen(false)}
          onDone={() => { fetchLeads(); refreshQuota() }}
        />
      )}
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: 'How does the lead search work?',
    a: 'We search publicly available business directories for your keyword and location, pulling business name, phone, website, address, and category. Results are scored by our AI model and saved to your account instantly.',
  },
  {
    q: 'How is the AI score calculated?',
    a: 'Each lead is scored 0–100 by our AI model based on how complete and reachable its public listing is — phone, website, address, rating and review count. 70–100 (green) is a complete, easily contactable listing. 40–69 (amber) is partial. Below 40 (red) is sparse. Leads marked "Unscored" were saved before scoring could run — re-run that search to score them. Note that this measures listing completeness, not how likely a business is to buy. The AI also writes a one-line summary, visible in the AI Summary export column.',
  },
  {
    q: 'Can I export my leads to Excel?',
    a: 'Yes — export to Excel or CSV. Select leads with the checkboxes and use the bottom bar, or export every filtered result at once using the Export all bar above the table.',
  },
  {
    q: 'What does each lead status mean?',
    a: 'New = freshly added to your list. Contacted = you\'ve reached out. Follow-up = needs another touch. Qualified = confirmed interest or fit. Not interested = ruled out. Converted = won. Update from the dropdown in each row; the Last contacted date fills in automatically.',
  },
  {
    q: 'Why am I seeing leads from other searches?',
    a: 'All your searches accumulate in one place so you can filter across them. Use the industry filter, source pill, and score slider to narrow down to what you need.',
  },
  {
    q: 'What happens when I hit my lead limit?',
    a: 'New searches will be blocked until you upgrade. Your existing leads remain accessible. Go to Pricing to upgrade your plan at any time.',
  },
  {
    q: 'Is my data private?',
    a: 'Yes. Each account has full isolation — you only ever see your own leads. No other user can access your data.',
  },
]

function FAQ() {
  const [open, setOpen] = useState(null)
  const toggle = useCallback((i) => setOpen(prev => prev === i ? null : i), [])

  return (
    <div style={{ marginTop: 48 }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#0B0D0C', letterSpacing: '-0.3px' }}>
          Frequently asked questions
        </div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>
          Everything you need to know about using LeadgenAI.
        </div>
      </div>

      <div style={{
        background: '#FFFFFF',
        border: '0.5px solid rgba(11,13,12,0.12)',
        borderRadius: 8,
        overflow: 'hidden',
      }}>
        {FAQ_ITEMS.map((item, i) => (
          <div
            key={i}
            style={{ borderTop: i === 0 ? 'none' : '0.5px solid rgba(0,0,0,0.08)' }}
          >
            <button
              onClick={() => toggle(i)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                gap: 16,
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 600, color: '#0B0D0C', lineHeight: 1.4 }}>
                {item.q}
              </span>
              <span style={{
                flexShrink: 0,
                fontSize: 18,
                color: '#109840',
                fontWeight: 300,
                transition: 'transform 0.2s',
                transform: open === i ? 'rotate(45deg)' : 'rotate(0deg)',
                display: 'inline-block',
              }}>+</span>
            </button>

            {open === i && (
              <div style={{
                padding: '0 20px 16px',
                fontSize: 14,
                color: '#4B5560',
                lineHeight: 1.7,
              }}>
                {item.a}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{
        marginTop: 16,
        padding: '14px 20px',
        background: '#EFF8F1',
        border: '0.5px solid rgba(37,99,235,0.2)',
        borderRadius: 8,
        fontSize: 13,
        color: '#109840',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>Still have questions?</span>
        <a
          href="mailto:leadgen.support@exommerce.online"
          style={{ fontWeight: 600, color: '#109840', textDecoration: 'underline' }}
        >
          Email us
        </a>
      </div>
    </div>
  )
}

function Th({ children, style = {} }) {
  return (
    <th style={{
      padding: '10px 14px',
      textAlign: 'left',
      fontSize: 11,
      fontWeight: 600,
      color: '#6B7280',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      whiteSpace: 'nowrap',
      // Header stays put while the rows scroll. The offset clears the sticky
      // top bar above it; without it the header hides underneath.
      position: 'sticky',
      top: 0,
      zIndex: 2,
      background: '#FFFFFF',
      boxShadow: 'inset 0 -0.5px 0 rgba(11,13,12,0.12)',
      ...style,
    }}>{children}</th>
  )
}

// Mirrors the real table's shape so the layout does not jump when rows arrive.
function TableSkeleton({ rows = 8 }) {
  return (
    <div style={{ padding: '14px 16px' }} aria-busy="true" aria-label="Loading leads">
      <style>{`@keyframes lgpulse { 0%,100% { opacity: 0.45 } 50% { opacity: 0.9 } }`}</style>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '9px 0' }}>
          {[18, '22%', '20%', '12%', 70, '10%'].map((w, j) => (
            <div key={j} style={{
              height: 11, width: w, borderRadius: 4,
              background: 'rgba(11,13,12,0.09)',
              animation: `lgpulse 1.4s ease-in-out ${i * 0.06}s infinite`,
            }} />
          ))}
        </div>
      ))}
    </div>
  )
}

function EmptyState({ filtered, onClear, onScrape }) {
  return (
    <div style={{ padding: '48px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: 28, marginBottom: 10 }}>{filtered ? '🔍' : '📋'}</div>
      <div style={{ fontSize: 15, fontWeight: 600, color: '#0B0D0C', marginBottom: 6 }}>
        {filtered ? 'No leads match these filters' : 'No leads yet'}
      </div>
      <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 18, lineHeight: 1.6 }}>
        {filtered
          ? 'Try widening the score range, or clearing the filters to see everything.'
          : 'Run your first search to start building your lead list.'}
      </div>
      {filtered ? (
        <button onClick={onClear} style={{
          padding: '8px 16px', background: '#109840', color: '#FFF',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>Clear all filters</button>
      ) : (
        <button onClick={onScrape} style={{
          padding: '8px 16px', background: '#109840', color: '#FFF',
          border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>+ Run your first scrape</button>
      )}
    </div>
  )
}

function Td({ children, onClick, style = {} }) {
  return (
    <td
      onClick={onClick}
      style={{ padding: '10px 14px', verticalAlign: 'middle', ...style }}
    >{children}</td>
  )
}

function ActionBtn({ children, onClick, accent = '#109840' }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 14px',
        background: accent,
        color: '#FFF',
        border: 'none',
        borderRadius: 8,
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
      }}
    >{children}</button>
  )
}

const ghostBtn = {
  padding: '5px 12px',
  background: '#FFFFFF',
  border: '0.5px solid rgba(37,99,235,0.35)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  color: '#109840',
  cursor: 'pointer',
}

const pagerBtn = {
  padding: '5px 12px',
  background: '#FFFFFF',
  border: '0.5px solid rgba(11,13,12,0.12)',
  borderRadius: 8,
  fontSize: 12.5,
  fontWeight: 600,
  color: '#4B5560',
}

const selectStyle = {
  padding: '7px 10px',
  border: `0.5px solid rgba(11,13,12,0.12)`,
  borderRadius: 8,
  fontSize: 13,
  color: '#0B0D0C',
  background: '#FFFFFF',
  outline: 'none',
}

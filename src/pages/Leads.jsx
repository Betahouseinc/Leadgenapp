import { useState, useEffect, useMemo, useCallback, Fragment } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { LEAD_STATUSES, normaliseStatus, statusMeta } from '../constants/leadStatus'
import { exportCsv, exportExcel } from '../utils/exportLeads'
import StatsBar from '../components/StatsBar'
import LeadDrawer from '../components/LeadDrawer'
import ScrapeModal from '../components/ScrapeModal'

const T = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  border: 'rgba(0,0,0,0.12)',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  blue: '#2563EB',
  blueL: '#EFF6FF',
  teal: '#1A8A72',
}

const INDUSTRIES = ['All', 'Real estate', 'IT Software', 'Manufacturing', 'Healthcare', 'Retail', 'Education', 'Pharma']
const SOURCES = ['All', 'Google Maps']
const SORTS = [
  { value: 'newest',      label: 'Newest first',  col: 'created_at', asc: false },
  { value: 'oldest',      label: 'Oldest first',  col: 'created_at', asc: true },
  { value: 'score_desc',  label: 'Highest score', col: 'score',      asc: false },
  { value: 'score_asc',   label: 'Lowest score',  col: 'score',      asc: true },
  { value: 'name_asc',    label: 'Name A-Z',      col: 'name',       asc: true },
]

const PAGE = 1000

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
      background: isGmaps ? '#E8F5E9' : '#E8F2FC',
      color: isGmaps ? '#2E7D32' : '#2D7DD2',
      whiteSpace: 'nowrap',
    }}>
      {isGmaps ? 'GMaps' : 'LinkedIn'}
    </span>
  )
}

function ScoreBar({ score = 0 }) {
  const color = score >= 75 ? '#2E7D32' : score >= 50 ? '#2563EB' : '#C44B4B'
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
  const [industry, setIndustry] = useState('All')
  const [source, setSource] = useState('All')
  const [minScore, setMinScore] = useState(0)
  const [status, setStatus] = useState('All')
  const [sort, setSort] = useState('newest')
  const [profile, setProfile] = useState(null)
  const [notesOpen, setNotesOpen] = useState(null)
  const [noteDraft, setNoteDraft] = useState('')
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteMsg, setNoteMsg] = useState(null)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(null)

  // Auth guard + load profile
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/login'); return }
      const { data } = await supabase
        .from('profiles')
        .select('*, plans(*)')
        .eq('id', session.user.id)
        .single()
      if (data) setProfile(data)
    })
  }, [navigate])

  const buildQuery = useCallback(() => {
    const s = SORTS.find(x => x.value === sort) || SORTS[0]
    let q = supabase.from('leads').select('*')
    if (status !== 'All') q = q.eq('status', status)
    return q.order(s.col, { ascending: s.asc, nullsFirst: false })
  }, [status, sort])

  // Supabase caps a request at 1000 rows; page through so filters and exports
  // always operate on the complete set, never a silent first page.
  const fetchAllRows = useCallback(async () => {
    const out = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await buildQuery().range(from, from + PAGE - 1)
      if (error) throw error
      out.push(...(data || []))
      if (!data || data.length < PAGE) break
    }
    return out
  }, [buildQuery])

  const fetchLeads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLeads(await fetchAllRows())
    } catch (e) {
      setError(e.message || 'Could not load leads. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [fetchAllRows])

  useEffect(() => { fetchLeads() }, [fetchLeads])

  const filtered = useMemo(() => {
    return leads.filter(l => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        (l.name || '').toLowerCase().includes(q) ||
        (l.company || '').toLowerCase().includes(q) ||
        (l.email || '').toLowerCase().includes(q)
      const matchIndustry = industry === 'All' || l.industry === industry
      const matchSource = source === 'All' ||
        (source === 'Google Maps' && (l.source === 'gmaps' || l.source === 'Google Maps')) ||
        (source === 'LinkedIn' && (l.source === 'linkedin' || l.source === 'LinkedIn'))
      const matchScore = (l.score || 0) >= minScore
      return matchSearch && matchIndustry && matchSource && matchScore
    })
  }, [leads, search, industry, source, minScore])

  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set())
    else setSelected(new Set(filtered.map(l => l.id)))
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
    const { data } = await supabase.from('leads').select('*').in('id', ids)
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

  const runExport = async (kind, scope) => {
    setError(null)
    setExporting(kind)
    try {
      let rows
      if (scope === 'selected') {
        rows = filtered.filter(l => selected.has(l.id))
      } else {
        rows = filtered.length === leads.length ? filtered : filtered
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
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: T.ink,
    }}>
      {/* Top bar */}
      <div style={{
        background: T.surface,
        borderBottom: `0.5px solid ${T.border}`,
        padding: '0 24px',
        height: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.blue, letterSpacing: '-0.5px' }}>
          LeadGen
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {/* Usage meter */}
          {profile && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginRight: 4 }}>
              <div>
                <div style={{ fontSize: 11, color: T.muted, marginBottom: 2 }}>
                  {profile.leads_used} / {profile.plans?.leads_per_month === -1 ? '∞' : profile.plans?.leads_per_month} leads
                  {' · '}
                  <span style={{ fontWeight: 600, color: T.blue }}>{profile.plans?.name}</span>
                </div>
                <div style={{ width: 100, height: 4, background: 'rgba(0,0,0,0.08)', borderRadius: 4 }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 4,
                    background: T.blue,
                    width: profile.plans?.leads_per_month === -1 ? '10%' :
                      `${Math.min(100, (profile.leads_used / profile.plans?.leads_per_month) * 100)}%`,
                  }} />
                </div>
              </div>
              <Link to="/pricing" style={{
                padding: '4px 10px',
                background: T.blueL,
                color: T.blue,
                border: `0.5px solid ${T.blue}`,
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                textDecoration: 'none',
              }}>Upgrade</Link>
            </div>
          )}
          <button
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
            }}
          >+ Run scrape</button>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              background: 'none',
              border: `0.5px solid ${T.border}`,
              borderRadius: 8,
              fontSize: 13,
              color: T.ink2,
              cursor: 'pointer',
            }}
          >Logout</button>
        </div>
      </div>

      {/* Main */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '24px 24px 80px' }}>
        <StatsBar leads={leads} />

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
            placeholder="Search name, company, email…"
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
              width: 220,
            }}
          />
          <select
            value={industry}
            onChange={e => setIndustry(e.target.value)}
            style={selectStyle}
          >
            {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
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

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexWrap: 'wrap' }}>
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

        {/* Export all filtered — visible when nothing is hand-selected */}
        {!loading && selected.size === 0 && filtered.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            marginBottom: 12, padding: '10px 14px',
            background: T.surface, border: `0.5px solid ${T.border}`, borderRadius: 8,
          }}>
            <span style={{ fontSize: 13, color: T.ink2 }}>
              Export all {filtered.length} result{filtered.length === 1 ? '' : 's'}
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
            <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 14 }}>
              Loading leads…
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: T.muted, fontSize: 14 }}>
              No leads found.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `0.5px solid ${T.border}` }}>
                  <Th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={selected.size === filtered.length && filtered.length > 0}
                      onChange={toggleAll}
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
                </tr>
              </thead>
              <tbody>
                {filtered.map(lead => (
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
                    <Td><ScoreBar score={lead.score || 0} /></Td>
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
          onClose={() => setScrapeOpen(false)}
          onDone={fetchLeads}
        />
      )}
    </div>
  )
}

const FAQ_ITEMS = [
  {
    q: 'How does the lead scraping work?',
    a: 'We run your search on Google Maps using Apify, pulling business name, phone, website, address, and category. Results are scored by Gemini AI and saved to your account instantly.',
  },
  {
    q: 'How is the AI score calculated?',
    a: 'Gemini AI evaluates each lead\'s data completeness, industry relevance, and online presence to assign a score from 0–100. Leads above 70 are considered high quality.',
  },
  {
    q: 'Can I export my leads to Excel?',
    a: 'Yes — export to Excel or CSV. Select leads with the checkboxes and use the bottom bar, or export every filtered result at once using the Export all bar above the table.',
  },
  {
    q: 'What does each lead status mean?',
    a: 'New = freshly scraped. Contacted = you\'ve reached out. Follow-up = needs another touch. Qualified = confirmed interest or fit. Not interested = ruled out. Converted = won. Update from the dropdown in each row; the Last contacted date fills in automatically.',
  },
  {
    q: 'Why am I seeing leads from other searches?',
    a: 'All your scrapes accumulate in one place so you can filter across them. Use the industry filter, source pill, and score slider to narrow down to what you need.',
  },
  {
    q: 'What happens when I hit my lead limit?',
    a: 'New scrapes will be blocked until you upgrade. Your existing leads remain accessible. Go to Pricing to upgrade your plan at any time.',
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
        <div style={{ fontSize: 18, fontWeight: 800, color: '#2C2416', letterSpacing: '-0.3px' }}>
          Frequently asked questions
        </div>
        <div style={{ fontSize: 13, color: '#9C8E7A', marginTop: 4 }}>
          Everything you need to know about using LeadgenAI.
        </div>
      </div>

      <div style={{
        background: '#FFFFFF',
        border: '0.5px solid rgba(0,0,0,0.12)',
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
              <span style={{ fontSize: 14, fontWeight: 600, color: '#2C2416', lineHeight: 1.4 }}>
                {item.q}
              </span>
              <span style={{
                flexShrink: 0,
                fontSize: 18,
                color: '#2563EB',
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
                color: '#5C5240',
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
        background: '#EFF6FF',
        border: '0.5px solid rgba(37,99,235,0.2)',
        borderRadius: 8,
        fontSize: 13,
        color: '#2563EB',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}>
        <span>Still have questions?</span>
        <a
          href="mailto:betahouseincorporation@gmail.com"
          style={{ fontWeight: 600, color: '#2563EB', textDecoration: 'underline' }}
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
      color: '#9C8E7A',
      textTransform: 'uppercase',
      letterSpacing: '0.4px',
      whiteSpace: 'nowrap',
      ...style,
    }}>{children}</th>
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

function ActionBtn({ children, onClick, accent = '#2563EB' }) {
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
  background: '#FAFAF7',
  border: '0.5px solid rgba(37,99,235,0.35)',
  borderRadius: 8,
  fontSize: 12,
  fontWeight: 600,
  color: '#2563EB',
  cursor: 'pointer',
}

const selectStyle = {
  padding: '7px 10px',
  border: `0.5px solid rgba(0,0,0,0.12)`,
  borderRadius: 8,
  fontSize: 13,
  color: '#2C2416',
  background: '#FAFAF7',
  outline: 'none',
}

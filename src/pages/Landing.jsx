import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

// Deliberately short: one idea per section, nothing a visitor has to study.
// An earlier, longer version read as "enterprise SaaS" for a product sold to
// small agencies and founders.
//
// The sample list is labelled "Sample" and uses generic names. Invented company
// names on a marketing page read as a customer list, and these are not
// customers.

const T = {
  green: '#109840',
  greenD: '#0E7D40',
  soft: '#EAF8EF',
  amber: '#9B5D08',
  amberL: '#FFF4DF',
  ink: '#151817',
  ink2: '#3F4945',
  muted: '#66706A',
  line: '#E7ECE9',
  bg: '#F7F9F8',
  card: '#FFFFFF',
}

// Cities span the markets the product is marketed in. The last row has no
// website on purpose: for an agency, that gap is the lead.
// `why` mirrors the one-line summary the AI writes for every lead.
const SAMPLE = [
  { what: 'Dental clinic',      city: 'Austin, US',    site: true,  phone: true, rating: '4.8★ · 212 reviews', score: 94, why: 'Established family practice, easy to reach by phone and web' },
  { what: 'Real estate agency', city: 'Dubai, AE',     site: true,  phone: true, rating: '4.6★ · 87 reviews',  score: 90, why: 'Active residential agency with strong recent reviews' },
  { what: 'Software company',   city: 'Bengaluru, IN', site: true,  phone: true, rating: '4.2★ · 31 reviews',  score: 82, why: 'Small IT services firm with a working website' },
  { what: 'Family restaurant',  city: 'Sydney, AU',    site: false, phone: true, rating: '4.4★ · 9 reviews',   score: 46, why: 'Well rated but no website and few reviews' },
]

// What "qualified" means here — the checks the AI score actually makes. Keep in
// step with buildScoringPrompt in supabase/functions/_shared/pipeline.ts.
const CHECKS = [
  {
    title: 'Right business',
    body: 'AI reads each listing and confirms what the business does, so your list stays on target.',
  },
  {
    title: 'Reachable',
    body: 'Website, phone and address are checked. Listings you can’t contact sink to the bottom.',
  },
  {
    title: 'Established',
    body: 'Rating and review count show which businesses are active and trusted locally.',
  },
  {
    title: 'Ranked and explained',
    body: 'Every lead gets a 0–100 score and a one-line reason. Start at the top.',
  },
]

export default function Landing() {
  const navigate = useNavigate()
  const [what, setWhat] = useState('')
  const [where, setWhere] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const start = (e) => {
    e.preventDefault()
    navigate('/signup')
  }

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', textAlign: 'left' }}>
      <style>{`
        /* index.css centres every line via #root { text-align:center } and caps
           it at 1126px. A marketing page sets its own measure. */
        #root { width: 100% !important; max-width: none !important; text-align: left !important; border-inline: none !important; }
        .lp-wrap { max-width: 1040px; margin: auto; padding: 0 24px; }
        .lp-search { display: grid; grid-template-columns: 1fr 1fr auto; gap: 8px; }
        .lp-four { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 14px; }
        @media (max-width: 940px) { .lp-four { grid-template-columns: repeat(2, minmax(0,1fr)); } }
        .lp-row { display: grid; grid-template-columns: minmax(0,1.4fr) minmax(0,1fr) minmax(0,1.6fr) 56px; gap: 12px; align-items: center; }
        .lp-input:focus { outline: 2px solid ${T.green}; outline-offset: -1px; }
        .lp-show-sm { display: none; }
        @media (max-width: 760px) {
          .lp-search, .lp-four { grid-template-columns: minmax(0,1fr) !important; }
          .lp-row { grid-template-columns: minmax(0,1fr) 48px !important; }
          .lp-hide-sm { display: none !important; }
          .lp-show-sm { display: block !important; }
          .lp-wrap { padding: 0 16px; }
        }
      `}</style>

      {/* ---------- Nav ---------- */}
      <header style={{ background: '#fff', borderBottom: `1px solid ${T.line}` }}>
        <div className="lp-wrap" style={{ height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 19 }}>Lead<span style={{ color: T.green }}>Gen</span>AI</div>
          <div style={{ display: 'flex', gap: 18, alignItems: 'center', fontSize: 14 }}>
            <Link to="/pricing" style={link}>Pricing</Link>
            <Link to="/login" style={link}>Sign in</Link>
            <button onClick={() => navigate('/signup')} style={btnPrimary}>Start free</button>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section style={{ background: '#fff', padding: '72px 0 56px', borderBottom: `1px solid ${T.line}` }}>
        <div className="lp-wrap" style={{ maxWidth: 760, textAlign: 'center' }}>
          <h1 style={{ fontSize: 'clamp(34px, 6vw, 54px)', lineHeight: 1.06, letterSpacing: '-1.5px', margin: '0 0 16px', fontWeight: 800, color: T.ink }}>
            Qualified local leads,<br /><span style={{ color: T.green }}>ready to contact</span>
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: T.muted, margin: '0 auto 30px', maxWidth: 580 }}>
            Pick an industry and a city in any of 41 countries. AI checks every
            business, scores it, and tells you why — so you start with the ones
            worth calling.
          </p>

          <form onSubmit={start} className="lp-search" style={{ textAlign: 'left', background: T.bg, border: `1px solid ${T.line}`, borderRadius: 14, padding: 8 }}>
            <label style={{ display: 'block' }}>
              <span style={sr}>What are you looking for?</span>
              <input className="lp-input" value={what} onChange={e => setWhat(e.target.value)} placeholder="Dental clinics" style={input} />
            </label>
            <label style={{ display: 'block' }}>
              <span style={sr}>Where?</span>
              <input className="lp-input" value={where} onChange={e => setWhere(e.target.value)} placeholder="Austin, United States" style={input} />
            </label>
            <button type="submit" style={{ ...btnPrimary, padding: '0 22px', minHeight: 46, fontSize: 15 }}>Find leads →</button>
          </form>

          <div style={{ display: 'flex', gap: 18, justifyContent: 'center', flexWrap: 'wrap', fontSize: 13, color: T.muted, marginTop: 16 }}>
            {['Every lead AI-scored', '41 countries', '10 free leads, no card'].map(t => (
              <span key={t}><b style={{ color: T.green, marginRight: 6 }}>✓</b>{t}</span>
            ))}
          </div>
          <div style={{ fontSize: 12.5, color: T.muted, marginTop: 10 }}>
            You’ll create a free account first.{' '}
            <button type="button" onClick={() => setShowDemo(v => !v)} style={{ background: 'none', border: 'none', padding: 0, color: T.greenD, fontWeight: 600, fontSize: 12.5, cursor: 'pointer' }}>
              {showDemo ? 'Hide the demo' : 'Or watch a 60-second demo ▸'}
            </button>
          </div>

          {showDemo && (
            <video
              src="/demo/leadgenai-demo.mp4"
              poster="/demo/leadgenai-demo-poster.jpg"
              controls
              autoPlay
              playsInline
              aria-label="LeadGenAI product demo, 60 seconds"
              style={{ display: 'block', width: '100%', aspectRatio: '16 / 9', background: T.ink, borderRadius: 14, marginTop: 22, border: `1px solid ${T.line}` }}
            />
          )}
        </div>
      </section>

      {/* ---------- How leads are qualified ---------- */}
      <section style={{ padding: '56px 0 0' }}>
        <div className="lp-wrap">
          <h2 style={{ ...h2, textAlign: 'center', marginBottom: 6 }}>How every lead is qualified</h2>
          <p style={{ textAlign: 'center', color: T.muted, fontSize: 15, margin: '0 0 22px' }}>
            Four checks on every business, before it reaches your list.
          </p>
          <div className="lp-four">
            {CHECKS.map((c, i) => (
              <div key={c.title} style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14, padding: 20 }}>
                <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.soft, color: T.greenD, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, marginBottom: 12 }}>✓</div>
                <h3 style={{ margin: '0 0 6px', fontSize: 15.5, color: T.ink }}>{i + 1}. {c.title}</h3>
                <p style={{ margin: 0, color: T.muted, fontSize: 13.5, lineHeight: 1.55 }}>{c.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Sample list ---------- */}
      <section style={{ padding: '56px 0 64px' }}>
        <div className="lp-wrap" style={{ maxWidth: 900 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, gap: 12, flexWrap: 'wrap' }}>
            <h2 style={h2}>Your list, ranked and explained</h2>
            <span style={{ ...chip, background: T.soft, color: T.greenD }}>SAMPLE</span>
          </div>
          <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div className="lp-row" style={{ padding: '12px 18px', fontSize: 11, color: T.muted, textTransform: 'uppercase', letterSpacing: '.05em', borderBottom: `1px solid ${T.line}` }}>
              <span>Business</span>
              <span className="lp-hide-sm">City</span>
              <span className="lp-hide-sm">Listing</span>
              <span style={{ textAlign: 'right' }}>Score</span>
            </div>
            {SAMPLE.map((s, i) => (
              <div key={s.what} className="lp-row" style={{ padding: '14px 18px', fontSize: 13.5, borderTop: i ? `1px solid ${T.line}` : 'none' }}>
                <span style={{ minWidth: 0 }}>
                  <b>{s.what}</b>
                  <small className="lp-show-sm" style={{ color: T.muted, marginTop: 2 }}>{s.city}{s.site ? '' : ' · no website'}</small>
                  <small style={{ display: 'block', color: T.ink2, marginTop: 3, fontSize: 12, lineHeight: 1.4 }}>“{s.why}”</small>
                </span>
                <span className="lp-hide-sm" style={{ color: T.ink2 }}>{s.city}</span>
                <span className="lp-hide-sm" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  {s.site
                    ? <span style={{ ...chip, background: T.soft, color: T.greenD }}>Website</span>
                    : <span style={{ ...chip, background: T.amberL, color: T.amber }}>No website</span>}
                  {s.phone && <span style={{ ...chip, background: T.bg, color: T.ink2 }}>Phone</span>}
                  <span style={{ fontSize: 12, color: T.muted }}>{s.rating}</span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ ...chip, background: s.score >= 80 ? T.soft : T.bg, color: s.score >= 80 ? T.greenD : T.ink2 }}>{s.score}</span>
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: T.muted, margin: '10px 2px 0', lineHeight: 1.55 }}>
            Up to 50 businesses per search, from public business listings. Qualified means a
            lead passed the four checks; whether they’re ready to buy is what your first email
            finds out — and AI drafts that for you.
          </p>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section style={{ background: T.green, padding: '56px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px,4vw,30px)', fontWeight: 800, color: '#fff', margin: '0 0 10px', letterSpacing: '-.5px' }}>
          Try it on a city you sell to
        </h2>
        <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,.88)', margin: '0 0 24px' }}>
          10 leads free, no card.
        </p>
        <button onClick={() => navigate('/signup')} style={{ background: '#fff', color: T.greenD, border: 'none', borderRadius: 10, padding: '13px 24px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Start free →
        </button>
      </section>

      {/* ---------- Footer ---------- */}
      <footer style={{ padding: '26px 0', background: '#fff', borderTop: `1px solid ${T.line}`, color: '#7A827E', fontSize: 12.5 }}>
        <div className="lp-wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <span>LeadGenAI · Qualified local business leads in 41 countries · Exommerce.online</span>
          <span style={{ display: 'flex', gap: 18 }}>
            <Link to="/pricing" style={link}>Pricing</Link>
            <Link to="/legal/privacy" style={link}>Privacy</Link>
            <Link to="/legal/terms" style={link}>Terms</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}

const link = { color: 'inherit', textDecoration: 'none' }
const h2 = { fontSize: 'clamp(20px,3vw,24px)', letterSpacing: '-.5px', margin: 0, fontWeight: 800, color: T.ink }
const chip = { display: 'inline-block', borderRadius: 99, padding: '3px 8px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }
const input = { width: '100%', boxSizing: 'border-box', minHeight: 46, padding: '0 14px', border: `1px solid ${T.line}`, borderRadius: 10, fontSize: 15, background: '#fff', color: T.ink }
const sr = { position: 'absolute', width: 1, height: 1, padding: 0, margin: -1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap', border: 0 }
const btnPrimary = { background: T.green, border: `1px solid ${T.green}`, color: '#fff', padding: '9px 16px', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }

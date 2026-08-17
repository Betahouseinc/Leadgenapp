import { useNavigate, Link } from 'react-router-dom'

// Built from leadgenai_ui_preview.html, section for section.
//
// The mock windows are labelled "Sample" wherever they show lead rows or
// counts. They illustrate the interface, and a visitor should not have to guess
// whether the companies in them are real customers — they are not.

const T = {
  green: '#109840',
  greenD: '#0E7D40',
  soft: '#EAF8EF',
  ink: '#151817',
  ink2: '#3F4945',
  muted: '#66706A',
  line: '#E7ECE9',
  bg: '#F7F9F8',
  card: '#FFFFFF',
}

const STEPS = [
  { n: 1, title: 'Define',   body: 'Tell LeadGenAI what industry, roles and locations you want to reach.' },
  { n: 2, title: 'Filter',   body: 'Set your target profile, how many leads you need and what data matters.' },
  { n: 3, title: 'Generate', body: 'Watch discovery, contact enrichment and AI scoring happen in real time.' },
  { n: 4, title: 'Act',      body: 'Review, export, draft outreach with AI or send leads onward.' },
]

// Illustrative rows for the hero window. Deliberately generic names — inventing
// company names and work email addresses on a marketing page reads as a
// customer list, and these are not customers.
const SAMPLE = [
  { what: 'Software company',   industry: 'IT Software',    city: 'Pune',    contact: 'Website · phone · email', score: 98 },
  { what: 'Real estate agency', industry: 'Real Estate',    city: 'Delhi',   contact: 'Website · phone · email', score: 96 },
  { what: 'Manufacturing firm', industry: 'Manufacturing',  city: 'Chennai', contact: 'Website · phone',         score: 88 },
  { what: 'Diagnostics clinic', industry: 'Healthcare',     city: 'Mumbai',  contact: 'Website · phone · email', score: 81 },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ background: T.bg, color: T.ink, fontFamily: 'system-ui, -apple-system, Segoe UI, sans-serif', textAlign: 'left' }}>
      <style>{`
        /* index.css centres every line via #root { text-align:center } and caps
           it at 1126px. A marketing page sets its own measure. */
        #root { width: 100% !important; max-width: none !important; text-align: left !important; border-inline: none !important; }
        .lg-wrap { max-width: 1180px; margin: auto; padding: 0 28px; }
        .lg-hero { display: grid; grid-template-columns: 1.05fr .95fr; gap: 60px; align-items: center; }
        .lg-steps { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 16px; }
        .lg-gen { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; align-items: start; }
        .lg-dash { display: grid; grid-template-columns: 210px minmax(0,1fr); }
        .lg-dashgrid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .lg-kpis { display: grid; grid-template-columns: repeat(4, minmax(0,1fr)); gap: 12px; }
        .lg-navlinks { display: flex; gap: 28px; }
        .lg-tablewrap { overflow-x: auto; }
        @media (max-width: 900px) {
          .lg-hero, .lg-gen, .lg-dashgrid { grid-template-columns: minmax(0,1fr) !important; }
          .lg-steps, .lg-kpis, .lg-stages { grid-template-columns: repeat(2, minmax(0,1fr)) !important; }
          .lg-dash { grid-template-columns: minmax(0,1fr) !important; }
          .lg-side { display: none !important; }
          .lg-navlinks { display: none !important; }
          .lg-wrap { padding: 0 18px; }
        }
      `}</style>

      {/* ---------- Nav ---------- */}
      <header style={{ height: 72, background: '#fff', borderBottom: `1px solid ${T.line}`, position: 'sticky', top: 0, zIndex: 50 }}>
        <div className="lg-wrap" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontWeight: 800, fontSize: 20 }}>Lead<span style={{ color: T.green }}>Gen</span>AI</div>
          <nav className="lg-navlinks" style={{ color: T.ink2, fontSize: 14 }}>
            <a href="#how" style={link}>How it works</a>
            <a href="#product" style={link}>Product</a>
            <a href="#reliable" style={link}>Reliability</a>
            <Link to="/pricing" style={link}>Pricing</Link>
          </nav>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Link to="/login" style={{ ...link, fontSize: 14 }}>Sign in</Link>
            <button onClick={() => navigate('/signup')} style={btnPrimary}>Get started</button>
          </div>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section style={{ background: '#fff', padding: '78px 0 66px' }}>
        <div className="lg-wrap lg-hero">
          <div>
            <span style={eyebrow}>AI-POWERED LEAD GENERATION</span>
            <h1 style={{ fontSize: 'clamp(38px, 5.5vw, 56px)', lineHeight: 1.04, letterSpacing: '-2px', margin: '20px 0 18px', fontWeight: 800, color: T.ink }}>
              Find qualified leads<br /><span style={{ color: T.green }}>with AI</span>
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.6, color: T.muted, maxWidth: 540, margin: 0 }}>
              Discover relevant companies, enrich their contact details, score every
              opportunity with AI and export a sales-ready list — from one workflow.
            </p>
            <div style={{ display: 'flex', gap: 12, margin: '28px 0', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/signup')} style={{ ...btnPrimary, padding: '13px 20px', fontSize: 15 }}>Start finding leads</button>
              <a href="#how" style={{ ...btnGhost, padding: '13px 20px', fontSize: 15 }}>See how it works</a>
            </div>
            <div style={{ display: 'flex', gap: 20, fontSize: 12.5, color: T.muted, flexWrap: 'wrap' }}>
              {['No credit card', 'Real generation progress', 'Export anytime'].map(t => (
                <span key={t}><b style={{ color: T.green, marginRight: 6 }}>✓</b>{t}</span>
              ))}
            </div>
          </div>

          {/* Product window */}
          <div style={{ background: T.bg, border: `1px solid ${T.line}`, borderRadius: 18, padding: 18, boxShadow: '0 18px 50px rgba(22,59,38,0.07)' }}>
            <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 12, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>Lead<span style={{ color: T.green }}>Gen</span>AI</div>
                <span style={{ ...chip, background: T.soft, color: T.greenD }}>SAMPLE RESULTS</span>
              </div>
              {SAMPLE.map((s, i) => (
                <div key={s.what} style={{
                  display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) auto', gap: 12,
                  padding: '13px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}`, fontSize: 12,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <b style={{ color: T.ink }}>{s.what} · {s.city}</b>
                    <small style={{ display: 'block', color: '#8A938E', marginTop: 3 }}>{s.contact}</small>
                  </div>
                  <span style={{ ...chip, background: T.soft, color: T.greenD, alignSelf: 'center' }}>{s.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" style={{ padding: '72px 0' }}>
        <div className="lg-wrap">
          <Head title="One workflow. No guesswork." sub="Stay on the job instead of navigating a complicated interface." />
          <div className="lg-steps">
            {STEPS.map(s => (
              <div key={s.n} style={panel}>
                <div style={{ width: 30, height: 30, borderRadius: '50%', background: T.soft, color: T.greenD, display: 'grid', placeItems: 'center', fontWeight: 800, marginBottom: 18 }}>{s.n}</div>
                <h3 style={{ margin: '0 0 8px', fontSize: 16, color: T.ink }}>{s.title}</h3>
                <p style={{ margin: 0, color: T.muted, fontSize: 13, lineHeight: 1.55 }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Product / dashboard ---------- */}
      <section id="product" style={{ padding: '0 0 72px' }}>
        <div className="lg-wrap">
          <Head title="A dashboard that answers “what next?”" sub="Four useful numbers, your recent searches and clear actions." />
          <div className="lg-dash" style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 16, overflow: 'hidden', boxShadow: '0 16px 45px rgba(22,59,38,0.06)' }}>
            <aside className="lg-side" style={{ background: '#17201C', color: '#DFE8E2', padding: 20 }}>
              <div style={{ fontWeight: 800, marginBottom: 26, fontSize: 14 }}>Lead<span style={{ color: '#53D788' }}>Gen</span>AI</div>
              {['Dashboard', 'Find Leads', 'Leads', 'AI Scoring', 'Outreach', 'Integrations'].map((s, i) => (
                <div key={s} style={{
                  padding: '11px 12px', borderRadius: 8, margin: '3px 0', fontSize: 13,
                  background: i === 0 ? T.green : 'transparent', color: i === 0 ? '#fff' : '#AEB9B2',
                }}>{s}</div>
              ))}
            </aside>
            <div style={{ padding: 24, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: T.muted, marginBottom: 12, letterSpacing: '.4px' }}>SAMPLE DASHBOARD</div>
              <div className="lg-kpis" style={{ marginBottom: 16 }}>
                {[['Total leads', '1,240'], ['New today', '87'], ['High score', '312'], ['Avg. score', '74']].map(([l, v]) => (
                  <div key={l} style={{ border: `1px solid ${T.line}`, borderRadius: 11, padding: 16, minWidth: 0 }}>
                    <small style={{ color: T.muted, fontSize: 11 }}>{l}</small>
                    <strong style={{ display: 'block', fontSize: 22, marginTop: 7 }}>{v}</strong>
                  </div>
                ))}
              </div>
              <div className="lg-dashgrid">
                <div style={panel}>
                  <h3 style={panelH}>Recent searches</h3>
                  {[['IT Software — Bengaluru', '50 leads'], ['Real Estate — Delhi', '25 leads'], ['Healthcare — Mumbai', '50 leads']].map(([a, b], i) => (
                    <div key={a} style={{ display: 'flex', justifyContent: 'space-between', padding: '11px 0', borderTop: i === 0 ? 'none' : `1px solid ${T.line}`, fontSize: 12 }}>
                      <b>{a}</b><span style={{ color: T.muted }}>{b}</span>
                    </div>
                  ))}
                </div>
                <div style={panel}>
                  <h3 style={panelH}>Leads by score</h3>
                  <div style={{ fontSize: 13, lineHeight: 2.1 }}>
                    <div><span style={{ ...chip, background: T.soft, color: T.greenD }}>80–100</span> 312 leads</div>
                    <div><span style={{ ...chip, background: T.soft, color: T.greenD }}>50–79</span> 616 leads</div>
                    <div><span style={{ ...chip, background: T.soft, color: T.greenD }}>0–49</span> 312 leads</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Reliability ---------- */}
      <section id="reliable" style={{ padding: '0 0 72px' }}>
        <div className="lg-wrap">
          <Head
            title="Generation should feel reliable."
            sub="Even when a provider slows down or fails, you keep the leads that already completed — and you can resume."
          />
          <div className="lg-gen">
            <div style={panel}>
              <h3 style={{ ...panelH, marginBottom: 4 }}>Define your search</h3>
              {[['What are you looking for?', 'IT Services Companies'], ['Location', 'Bengaluru, India'], ['Lead count', '50 leads']].map(([l, v]) => (
                <div key={l}>
                  <div style={{ fontSize: 12, fontWeight: 700, margin: '16px 0 7px' }}>{l}</div>
                  <div style={{ border: `1px solid ${T.line}`, borderRadius: 8, padding: 13, background: '#fff', color: T.ink2, fontSize: 13 }}>{v}</div>
                </div>
              ))}
              <button onClick={() => navigate('/signup')} style={{ ...btnPrimary, marginTop: 22, padding: '12px 18px' }}>Start generation →</button>
            </div>

            <div style={panel}>
              <h3 style={{ ...panelH, marginBottom: 4 }}>Generating your leads…</h3>
              <div style={{ fontSize: 44, fontWeight: 800, margin: '18px 0 5px', color: T.ink }}>45/50</div>
              <div style={{ color: T.muted, fontSize: 13, marginBottom: 12 }}>90% scored</div>
              <div style={{ height: 9, background: '#E9EEEB', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: '90%', height: '100%', background: T.green }} />
              </div>
              <div className="lg-stages" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10, marginTop: 22 }}>
                {[['✓', 'Companies', 'saved'], ['✓', 'Contacts', 'enriched'], ['◉', 'AI scoring', 'in progress'], ['○', 'Finishing', 'pending']].map(([i, a, b]) => (
                  <div key={a} style={{ fontSize: 11.5, color: T.muted }}>
                    <b style={{ display: 'block', color: T.greenD, marginBottom: 4 }}>{i}</b>{a}<br />{b}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 22, padding: 12, background: '#F3FAF5', borderRadius: 9, fontSize: 12.5, color: '#4F5A54', lineHeight: 1.55 }}>
                You can close this page. Your job keeps running and your results are
                saved as they arrive.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Results ---------- */}
      <section style={{ padding: '0 0 72px' }}>
        <div className="lg-wrap">
          <Head title="Results built for action" sub="Every lead easy to scan, qualify and act on." />
          <div style={{ background: '#fff', border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{ padding: 18, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <b style={{ fontSize: 14 }}>50 leads found <span style={{ color: T.muted, fontWeight: 400 }}>· sample</span></b>
              <div style={{ display: 'flex', gap: 8 }}>
                <span style={btnGhost}>Export</span>
                <span style={btnPrimary}>Draft outreach</span>
              </div>
            </div>
            <div className="lg-tablewrap">
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 620 }}>
                <thead>
                  <tr>{['Company', 'Industry', 'Contact', 'City', 'Score'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '14px 16px', borderTop: `1px solid ${T.line}`, color: '#727B76', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em' }}>{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {SAMPLE.map(s => (
                    <tr key={s.what}>
                      <td style={td}><b>{s.what}</b></td>
                      <td style={td}>{s.industry}</td>
                      <td style={td}>{s.contact}</td>
                      <td style={td}>{s.city}</td>
                      <td style={td}><span style={{ ...chip, background: T.soft, color: T.greenD }}>{s.score}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- CTA ---------- */}
      <section style={{ background: T.green, padding: '68px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 'clamp(24px,4vw,32px)', fontWeight: 800, color: '#fff', margin: '0 0 14px', letterSpacing: '-.5px' }}>
          Ready to fill your pipeline?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,.85)', marginBottom: 30 }}>
          Create your free account and run your first AI-scored lead search.
        </p>
        <button onClick={() => navigate('/signup')} style={{ background: '#fff', color: T.green, border: 'none', borderRadius: 10, padding: '14px 26px', fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
          Get started free →
        </button>
      </section>

      {/* ---------- Footer ---------- */}
      <footer style={{ padding: '32px 0', background: '#fff', borderTop: `1px solid ${T.line}`, color: '#7A827E', fontSize: 12.5 }}>
        <div className="lg-wrap" style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <span>LeadGenAI · AI-powered lead generation · Exommerce.online</span>
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

function Head({ title, sub }) {
  return (
    <div style={{ textAlign: 'center', maxWidth: 650, margin: '0 auto 34px' }}>
      <h2 style={{ fontSize: 'clamp(24px,3.4vw,34px)', letterSpacing: '-1px', margin: '0 0 10px', color: T.ink, fontWeight: 800 }}>{title}</h2>
      <p style={{ color: T.muted, lineHeight: 1.6, margin: 0 }}>{sub}</p>
    </div>
  )
}

const link = { color: 'inherit', textDecoration: 'none' }
const panel = { background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: 22, minWidth: 0 }
const panelH = { fontSize: 14, margin: '0 0 16px', color: T.ink }
const td = { textAlign: 'left', padding: '14px 16px', borderTop: `1px solid ${T.line}`, color: T.ink2 }
const chip = { display: 'inline-block', borderRadius: 99, padding: '4px 8px', fontSize: 10.5, fontWeight: 800, whiteSpace: 'nowrap' }
const eyebrow = { display: 'inline-flex', background: T.soft, color: T.greenD, padding: '7px 11px', borderRadius: 99, fontSize: 12, fontWeight: 700 }
const btnPrimary = { background: T.green, border: `1px solid ${T.green}`, color: '#fff', padding: '10px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }
const btnGhost = { border: `1px solid ${T.line}`, background: '#fff', color: T.ink2, padding: '10px 16px', borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: 'pointer', textDecoration: 'none', display: 'inline-block' }

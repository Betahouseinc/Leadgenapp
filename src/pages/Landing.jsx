import { useNavigate } from 'react-router-dom'

const T = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  ink: '#2C2416',
  ink2: '#5C5240',
  muted: '#9C8E7A',
  border: 'rgba(0,0,0,0.12)',
  blue: '#2563EB',
  blueD: '#1D4ED8',
  blueL: '#EFF6FF',
  teal: '#1A8A72',
  tealL: '#E0F5F0',
}

const features = [
  {
    icon: '🗺️',
    title: 'Google Maps Scraping',
    desc: 'Pull thousands of business leads from Google Maps by keyword and location in seconds.',
  },
  {
    icon: '🤖',
    title: 'AI Lead Scoring',
    desc: 'Gemini AI scores every lead 0–100 and writes a personalized outreach summary automatically.',
  },
  {
    icon: '📊',
    title: 'Smart Dashboard',
    desc: 'Filter by industry, score, and source. See your hottest leads at a glance.',
  },
  {
    icon: '📥',
    title: 'Excel Export',
    desc: 'Download your leads as a clean Excel file ready to share with your team.',
  },
  {
    icon: '🔒',
    title: 'Your Data Only',
    desc: 'Each account sees only its own leads. Full multi-tenant isolation built in.',
  },
  {
    icon: '💳',
    title: 'Pay-as-you-grow',
    desc: 'Start free with 10 leads. Upgrade to Starter, Pro, or Agency as your pipeline grows.',
  },
]

const industries = ['Real Estate', 'Healthcare', 'Pharma', 'Retail', 'Finance', 'Legal', 'Education', 'Hospitality', 'Construction', 'Technology']

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div style={{ fontFamily: 'system-ui, -apple-system, sans-serif', background: T.bg, color: T.ink }}>

      {/* NAV */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(250,250,247,0.92)', backdropFilter: 'blur(10px)',
        borderBottom: `0.5px solid ${T.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 32px', height: 56,
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, color: T.blue, letterSpacing: '-0.5px' }}>LeadgenAI</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={() => navigate('/pricing')}
            style={{ background: 'none', border: 'none', fontSize: 14, fontWeight: 500, color: T.ink2, cursor: 'pointer', padding: '8px 12px' }}
          >Pricing</button>
          <button
            onClick={() => navigate('/login')}
            style={{ background: 'none', border: `1px solid ${T.border}`, fontSize: 14, fontWeight: 500, color: T.ink, cursor: 'pointer', padding: '8px 16px', borderRadius: 8 }}
          >Sign in</button>
          <button
            onClick={() => navigate('/signup')}
            style={{ background: T.blue, border: 'none', fontSize: 14, fontWeight: 600, color: '#FFF', cursor: 'pointer', padding: '8px 18px', borderRadius: 8 }}
          >Get started free</button>
        </div>
      </nav>

      {/* HERO */}
      <section style={{ textAlign: 'center', padding: '88px 24px 64px' }}>
        <div style={{
          display: 'inline-block',
          background: T.blueL, color: T.blue,
          fontSize: 12, fontWeight: 700, letterSpacing: '0.5px',
          padding: '4px 14px', borderRadius: 20, marginBottom: 24,
          border: `1px solid rgba(37,99,235,0.2)`,
        }}>AI-POWERED LEAD GENERATION</div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)',
          fontWeight: 800, lineHeight: 1.1,
          color: T.ink, margin: '0 auto 24px',
          maxWidth: 700, letterSpacing: '-1.5px',
        }}>
          Find qualified leads<br />
          <span style={{ color: T.blue }}>in under 60 seconds</span>
        </h1>

        <p style={{
          fontSize: 18, color: T.ink2, maxWidth: 520,
          margin: '0 auto 40px', lineHeight: 1.6,
        }}>
          LeadgenAI scrapes Google Maps, scores every business with Gemini AI,
          and delivers a prioritised lead list — ready to export and outreach.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/signup')}
            style={{
              background: T.blue, color: '#FFF',
              border: 'none', borderRadius: 10,
              fontSize: 16, fontWeight: 700,
              padding: '14px 32px', cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(37,99,235,0.35)',
            }}
          >Start for free →</button>
          <button
            onClick={() => navigate('/pricing')}
            style={{
              background: T.surface, color: T.blue,
              border: `1px solid ${T.border}`, borderRadius: 10,
              fontSize: 16, fontWeight: 600,
              padding: '14px 32px', cursor: 'pointer',
            }}
          >See pricing</button>
        </div>

        <p style={{ marginTop: 16, fontSize: 13, color: T.muted }}>No credit card required · 10 free leads included</p>
      </section>

      {/* MOCK DASHBOARD PREVIEW */}
      <section style={{ padding: '0 24px 80px' }}>
        <div style={{
          maxWidth: 900, margin: '0 auto',
          background: T.surface,
          border: `0.5px solid ${T.border}`,
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.08)',
        }}>
          {/* fake browser chrome */}
          <div style={{
            background: '#F0F0ED', borderBottom: `0.5px solid ${T.border}`,
            padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
            <div style={{
              flex: 1, textAlign: 'center', fontSize: 12, color: T.muted,
              background: T.surface, borderRadius: 6, padding: '3px 12px',
              marginLeft: 12, maxWidth: 280, margin: '0 auto',
            }}>leadgenapp.vercel.app/leads</div>
          </div>
          {/* fake dashboard */}
          <div style={{ padding: 24 }}>
            {/* stats row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total Leads', val: '247' },
                { label: 'New Today', val: '38' },
                { label: 'Qualified (70+)', val: '112' },
                { label: 'Avg Score', val: '74' },
              ].map(s => (
                <div key={s.label} style={{
                  flex: '1 1 100px', background: T.bg,
                  border: `0.5px solid ${T.border}`, borderRadius: 8, padding: '14px 16px',
                }}>
                  <div style={{ fontSize: 11, color: T.muted, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: T.blue }}>{s.val}</div>
                </div>
              ))}
            </div>
            {/* leads table rows */}
            <div style={{ border: `0.5px solid ${T.border}`, borderRadius: 8, overflow: 'hidden' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px',
                background: T.bg, padding: '8px 16px',
                fontSize: 11, fontWeight: 600, color: T.muted, gap: 8,
              }}>
                <span>BUSINESS NAME</span><span>INDUSTRY</span><span>LOCATION</span><span>SCORE</span>
              </div>
              {[
                { name: 'Apex Pharma Solutions', ind: 'Pharma', loc: 'Mumbai', score: 92, color: '#1A8A72' },
                { name: 'CityMed Clinic', ind: 'Healthcare', loc: 'Delhi', score: 87, color: '#1A8A72' },
                { name: 'BuildRight Constructions', ind: 'Construction', loc: 'Pune', score: 73, color: T.blue },
                { name: 'Premier Legal Associates', ind: 'Legal', loc: 'Bangalore', score: 68, color: T.blue },
                { name: 'GreenLeaf Retail Co.', ind: 'Retail', loc: 'Hyderabad', score: 55, color: T.muted },
              ].map((row, i) => (
                <div key={i} style={{
                  display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 60px',
                  padding: '10px 16px', gap: 8, alignItems: 'center',
                  borderTop: `0.5px solid ${T.border}`,
                  fontSize: 13,
                }}>
                  <span style={{ fontWeight: 500, color: T.ink }}>{row.name}</span>
                  <span style={{ color: T.ink2 }}>{row.ind}</span>
                  <span style={{ color: T.ink2 }}>{row.loc}</span>
                  <span style={{
                    fontWeight: 700, color: row.color,
                    background: row.color + '18', borderRadius: 6,
                    padding: '2px 8px', textAlign: 'center', fontSize: 12,
                  }}>{row.score}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* INDUSTRIES */}
      <section style={{ background: T.surface, borderTop: `0.5px solid ${T.border}`, borderBottom: `0.5px solid ${T.border}`, padding: '32px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: T.muted, marginBottom: 16, letterSpacing: '0.5px' }}>WORKS ACROSS EVERY INDUSTRY</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {industries.map(ind => (
              <span key={ind} style={{
                background: T.blueL, color: T.blue,
                border: `1px solid rgba(37,99,235,0.15)`,
                borderRadius: 20, padding: '5px 14px',
                fontSize: 13, fontWeight: 500,
              }}>{ind}</span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '80px 24px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, color: T.ink, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Everything you need to fill your pipeline</h2>
            <p style={{ fontSize: 16, color: T.ink2, margin: 0 }}>From scraping to outreach, LeadgenAI handles the heavy lifting.</p>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 24 }}>
            {features.map(f => (
              <div key={f.title} style={{
                background: T.surface, border: `0.5px solid ${T.border}`,
                borderRadius: 12, padding: '24px',
              }}>
                <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: T.ink, marginBottom: 8 }}>{f.title}</div>
                <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ background: T.blueL, padding: '80px 24px', borderTop: `0.5px solid rgba(37,99,235,0.15)`, borderBottom: `0.5px solid rgba(37,99,235,0.15)` }}>
        <div style={{ maxWidth: 700, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: T.ink, margin: '0 0 48px', letterSpacing: '-0.5px' }}>How it works</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32, textAlign: 'left' }}>
            {[
              { n: '1', title: 'Enter a keyword + city', desc: 'Type what you\'re looking for — "dental clinics in Mumbai" or "pharma distributors in Delhi".' },
              { n: '2', title: 'We scrape Google Maps', desc: 'Our engine pulls business name, address, phone, website, rating, reviews — everything publicly available.' },
              { n: '3', title: 'AI scores every lead', desc: 'Gemini AI reads each profile and assigns a quality score 0–100 plus a human-readable outreach summary.' },
              { n: '4', title: 'You close deals', desc: 'Filter, sort, export to Excel, and start reaching out to your best prospects immediately.' },
            ].map(step => (
              <div key={step.n} style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
                <div style={{
                  flexShrink: 0, width: 40, height: 40, borderRadius: '50%',
                  background: T.blue, color: '#FFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 800,
                }}>{step.n}</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: T.ink, marginBottom: 4 }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: T.ink2, lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING TEASER */}
      <section style={{ padding: '80px 24px', textAlign: 'center' }}>
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, color: T.ink, margin: '0 0 12px', letterSpacing: '-0.5px' }}>Start free, scale when ready</h2>
          <p style={{ fontSize: 16, color: T.ink2, marginBottom: 40 }}>No credit card needed. Get 10 leads free, then upgrade for more.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { name: 'Free', price: '₹0', desc: '10 leads total', highlight: false },
              { name: 'Starter', price: '₹999/mo', desc: '500 leads/month', highlight: false },
              { name: 'Pro', price: '₹2,999/mo', desc: '2,000 leads/month', highlight: true },
              { name: 'Agency', price: '₹7,999/mo', desc: 'Unlimited leads', highlight: false },
            ].map(p => (
              <div key={p.name} style={{
                flex: '1 1 120px', maxWidth: 160,
                background: p.highlight ? T.blue : T.surface,
                border: p.highlight ? `2px solid ${T.blue}` : `0.5px solid ${T.border}`,
                borderRadius: 10, padding: '20px 16px',
                color: p.highlight ? '#FFF' : T.ink,
              }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>{p.name}</div>
                <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>{p.price}</div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{p.desc}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 32 }}>
            <button
              onClick={() => navigate('/pricing')}
              style={{
                background: T.blue, color: '#FFF',
                border: 'none', borderRadius: 10,
                fontSize: 15, fontWeight: 700,
                padding: '12px 28px', cursor: 'pointer',
              }}
            >View full pricing →</button>
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section style={{
        background: T.blue, padding: '72px 24px', textAlign: 'center',
      }}>
        <h2 style={{ fontSize: 32, fontWeight: 800, color: '#FFF', margin: '0 0 16px', letterSpacing: '-0.5px' }}>
          Ready to find your next 100 clients?
        </h2>
        <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.8)', marginBottom: 32 }}>
          Create your free account and run your first lead search in 60 seconds.
        </p>
        <button
          onClick={() => navigate('/signup')}
          style={{
            background: '#FFF', color: T.blue,
            border: 'none', borderRadius: 10,
            fontSize: 16, fontWeight: 700,
            padding: '14px 32px', cursor: 'pointer',
          }}
        >Get started free →</button>
      </section>

      {/* FOOTER */}
      <footer style={{
        background: T.surface,
        borderTop: `0.5px solid ${T.border}`,
        padding: '32px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        flexWrap: 'wrap', gap: 12,
      }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.blue }}>LeadgenAI</div>
        <div style={{ fontSize: 13, color: T.muted }}>
          © 2025 Betahouse Inc. · <a href="mailto:betahouseincorporation@gmail.com" style={{ color: T.blue, textDecoration: 'none' }}>betahouseincorporation@gmail.com</a>
        </div>
        <div style={{ display: 'flex', gap: 20 }}>
          <button onClick={() => navigate('/pricing')} style={{ background: 'none', border: 'none', fontSize: 13, color: T.ink2, cursor: 'pointer' }}>Pricing</button>
          <button onClick={() => navigate('/login')} style={{ background: 'none', border: 'none', fontSize: 13, color: T.ink2, cursor: 'pointer' }}>Sign in</button>
          <button onClick={() => navigate('/signup')} style={{ background: 'none', border: 'none', fontSize: 13, color: T.ink2, cursor: 'pointer' }}>Sign up</button>
        </div>
      </footer>
    </div>
  )
}

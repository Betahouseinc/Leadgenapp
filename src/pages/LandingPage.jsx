import { useState } from "react";

const T = {
  saffron: "#E8821A", saffronB: "#D4700F", saffronL: "#FFF4E6",
  teal: "#1A8A72", tealL: "#E6F5F1",
  amber: "#F5A623", amberL: "#FFF8E6",
  ink: "#2C2416", ink2: "#5C4A32",
  muted: "#8B7355", border: "#E8DDD0", border2: "#C8B89A",
  bg: "#FAFAF7", surface: "#FFFFFF", panel: "#F5F0E8",
  plum: "#7C3D8F", plumL: "#F5EDF8",
  rose: "#C0392B", roseL: "#FEF0EE",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&family=Montserrat:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Nunito', sans-serif; background: #FAFAF7; }
  h1,h2,h3,h4,h5 { font-family: 'Montserrat', sans-serif; }
  .land-hero { font-family: 'Montserrat', sans-serif; }
  .land-sub { font-family: 'Nunito', sans-serif; }
  .cta-btn { transition: transform .15s, box-shadow .15s; }
  .cta-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(232,130,26,.35) !important; }
  .ghost-btn { transition: background .15s, border-color .15s; }
  .ghost-btn:hover { background: #F5F0E8 !important; border-color: #C8B89A !important; }
  .badge-pop { animation: badgePop .4s ease; }
  @keyframes badgePop { from { opacity:0; transform:scale(.8); } to { opacity:1; transform:scale(1); } }
  .float-a { animation: floatA 3.5s ease-in-out infinite; }
  .float-b { animation: floatB 4s ease-in-out infinite .6s; }
  .float-c { animation: floatA 3.2s ease-in-out infinite 1.2s; }
  @keyframes floatA { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
  @keyframes floatB { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
  .feature-card { transition: transform .2s, box-shadow .2s; }
  .feature-card:hover { transform: translateY(-4px); box-shadow: 0 12px 32px rgba(44,36,22,.1) !important; }
  .plan-card { transition: transform .2s, box-shadow .2s; }
  .plan-card:hover { transform: translateY(-4px); box-shadow: 0 16px 40px rgba(44,36,22,.12) !important; }
  .svc-card { transition: transform .2s, box-shadow .2s; }
  .svc-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(44,36,22,.1) !important; }
  .toggle-pill { transition: background .2s; }
  @media (max-width: 600px) {
    .land-hero { font-size: 30px !important; }
    .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .features-grid { grid-template-columns: 1fr !important; }
    .steps-grid { grid-template-columns: 1fr !important; }
    .plans-grid { grid-template-columns: 1fr !important; }
    .svc-grid { grid-template-columns: repeat(2, 1fr) !important; }
    .testimonials-grid { grid-template-columns: 1fr !important; }
    .footer-grid { grid-template-columns: 1fr !important; }
  }
`;

const PLANS = [
  { name:"Free", monthly:0, yearly:0, monthlyLabel:"\u20b90/mo", yearlyLabel:"\u20b90/yr",
    desc:"Perfect for getting started", unitLimit:"1 Unit",
    features:["1 Unit","Basic rent tracking","Expense tracking","OTP login","Mobile app"],
    cta:"Get Started Free", sub:"No credit card needed", color:T.teal, bg:T.tealL, highlight:false },
  { name:"Starter", monthly:500, yearly:5000, monthlyLabel:"\u20b9500/mo", yearlyLabel:"\u20b95,000/yr",
    desc:"Growing landlords with a few units", unitLimit:"3 Units",
    features:["3 Units","Phone reminders","Maintenance requests","Tenant portal","Email support"],
    cta:"Start Free Trial", sub:"15-day free trial", color:T.amber, bg:T.amberL, highlight:false },
  { name:"Growth", monthly:1000, yearly:10000, monthlyLabel:"\u20b91,000/mo", yearlyLabel:"\u20b910,000/yr",
    desc:"Most popular for serious landlords", unitLimit:"5 Units",
    features:["5 Units","Multi-unit support","AI insights","Profit & expense tracking","Priority support"],
    cta:"Start Free Trial", sub:"15-day free trial", color:T.saffron, bg:T.saffronL, highlight:true },
  { name:"Pro", monthly:1500, yearly:15000, monthlyLabel:"\u20b91,500/mo", yearlyLabel:"\u20b915,000/yr",
    desc:"Advanced automation + AI features", unitLimit:"10 Units",
    features:["10 Units","Advanced AI analytics","Custom automation","Dedicated support","API access"],
    cta:"Start Free Trial", sub:"15-day free trial", color:T.teal, bg:T.tealL, highlight:false },
  { name:"Business", monthly:null, yearly:null, monthlyLabel:"\u20b92,500+/mo", yearlyLabel:"Custom/yr",
    desc:"Property managers & agencies", unitLimit:"10+ Units",
    features:["10+ Units","Priority support","Custom automation","Advanced AI analytics","Custom integrations"],
    cta:"Contact Sales", sub:"Custom pricing available", color:T.plum, bg:T.plumL, highlight:false },
];

const SERVICES = [
  { icon:"\ud83c\udfe0", title:"Property Setup", desc:"Full onboarding — units, tenants, agreements loaded for you." },
  { icon:"\ud83d\udcdd", title:"Rent Agreement Drafting", desc:"Legally-sound rental agreements drafted and delivered fast." },
  { icon:"\ud83d\udcca", title:"Financial Reports", desc:"Monthly P&L, tax-ready statements, and occupancy reports." },
  { icon:"\ud83d\udd27", title:"Maintenance Coordination", desc:"We manage vendor calls, follow-ups, and resolution tracking." },
  { icon:"\ud83d\udce3", title:"Tenant Listing & Marketing", desc:"Advertise vacancies across platforms and find quality tenants." },
  { icon:"\u2696\ufe0f", title:"Legal Assistance", desc:"Eviction support, notice drafting, and compliance guidance." },
];

const TESTIMONIALS = [
  { name:"Ramesh K.", role:"Landlord, Bangalore", text:"RentAI completely changed how I manage my 6 properties. No more WhatsApp chaos!", rating:5 },
  { name:"Priya S.", role:"Property Owner, Hyderabad", text:"The AI insights helped me realize I was undercharging rent by 15%. Incredible tool.", rating:5 },
  { name:"Arjun M.", role:"Real Estate Investor, Chennai", text:"Setup was under 5 minutes and my tenants love the UPI payment reminders.", rating:5 },
];

export default function LandingPage({ onGetStarted, onServices }) {
  const [yearly, setYearly] = useState(false);
  return (
    <div style={{ fontFamily:"'Nunito',sans-serif", background:T.bg, minHeight:"100vh", color:T.ink }}>
      <style>{CSS}</style>
      <nav style={{ position:"sticky", top:0, zIndex:100, background:T.surface+"EE",
        backdropFilter:"blur(12px)", borderBottom:"1px solid "+T.border,
        padding:"0 24px", height:60 }}>
        <div style={{ maxWidth:1000, margin:"0 auto", height:"100%", display:"flex",
          alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:36, height:36, borderRadius:10,
              background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, boxShadow:"0 4px 12px "+T.saffron+"40" }}>\ud83c\udfe1</div>
            <span style={{ fontSize:19, fontWeight:900, color:T.ink, letterSpacing:"-.3px",
              fontFamily:"Montserrat,sans-serif" }}>RentAI</span>
            <span style={{ fontSize:10, fontWeight:800, color:T.saffron,
              background:T.saffronL, padding:"2px 9px", borderRadius:20,
              border:"1px solid "+T.saffron+"30" }}>BETA</span>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <button onClick={() => onServices && onServices()} style={{ padding:"8px 16px",
              borderRadius:10, fontSize:13, fontWeight:700, border:"none",
              background:"transparent", color:T.ink2, cursor:"pointer" }}>Services</button>
            <button onClick={onGetStarted} style={{ padding:"9px 20px", borderRadius:10,
              fontSize:13, fontWeight:800, border:"1.5px solid "+T.border2,
              background:"transparent", color:T.ink, cursor:"pointer" }}>Login \u2192</button>
          </div>
        </div>
      </nav>
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"60px 24px 44px", textAlign:"center" }}>
        <div className="badge-pop" style={{ display:"inline-flex", alignItems:"center", gap:7,
          background:T.tealL, border:"1.5px solid "+T.teal+"30", borderRadius:30,
          padding:"6px 18px", marginBottom:24, fontSize:12, fontWeight:800, color:T.teal }}>
          \u2728 Built for Indian landlords
        </div>
        <h1 className="land-hero" style={{ fontSize:"clamp(30px,6vw,54px)", fontWeight:900,
          color:T.ink, lineHeight:1.12, letterSpacing:"-.5px", marginBottom:20 }}>
          Manage rent.{" "}
          <span style={{ background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
            WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>Effortlessly.</span>
        </h1>
        <p className="land-sub" style={{ fontSize:"clamp(14px,3.5vw,18px)", color:T.ink2,
          maxWidth:530, margin:"0 auto 36px", lineHeight:1.75, fontWeight:500 }}>
          RentAI is your AI-powered rental manager — collect rent, track expenses, manage tenants,
          and handle maintenance — all in one place. No Excel. No chasing.
        </p>
        <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
          <button onClick={onGetStarted} className="cta-btn"
            style={{ padding:"15px 34px", borderRadius:14, fontSize:16, fontWeight:900,
              border:"none", color:"#ffffff", cursor:"pointer",
              background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+","+T.amber+")",
              boxShadow:"0 6px 20px "+T.saffron+"40" }}>
            Get Started Free \u2192
          </button>
          <button onClick={onGetStarted} className="ghost-btn"
            style={{ padding:"15px 28px", borderRadius:14, fontSize:15, fontWeight:800,
              border:"2px solid "+T.border2, background:T.surface, color:T.ink2, cursor:"pointer" }}>
            I'm a Tenant
          </button>
        </div>
        <div style={{ marginTop:28, display:"flex", justifyContent:"center", gap:8, flexWrap:"wrap" }}>
          {["\ud83d\udd12 Secure OTP login","\ud83d\udcb8 UPI ready","\ud83d\udcf1 Mobile first","\ud83c\uddee\ud83c\uddf3 Made in India"].map(t => (
            <span key={t} style={{ fontSize:11, fontWeight:700, color:T.muted,
              background:T.panel, border:"1px solid "+T.border, padding:"4px 12px", borderRadius:20 }}>{t}</span>
          ))}
        </div>
      </section>
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"0 24px 52px" }}>
        <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
          {[
            { cls:"float-a", emoji:"\ud83c\udfe0", label:"3 BHK, Indiranagar", sub:"Rent due in 3 days", color:T.saffron, bg:T.saffronL },
            { cls:"float-b", emoji:"\u2705", label:"Payment received!", sub:"\u20b925,000 from Tenant #3", color:T.teal, bg:T.tealL },
            { cls:"float-c", emoji:"\ud83d\udcca", label:"Monthly P&L ready", sub:"Net income: \u20b91.2L", color:T.amber, bg:T.amberL },
          ].map(c => (
            <div key={c.label} className={c.cls} style={{ background:T.surface,
              border:"1.5px solid "+c.color+"30", borderRadius:16, padding:"14px 18px",
              display:"flex", alignItems:"center", gap:12,
              boxShadow:"0 4px 16px rgba(44,36,22,.08)" }}>
              <div style={{ width:40, height:40, borderRadius:10, background:c.bg,
                display:"flex", alignItems:"center", justifyContent:"center", fontSize:20 }}>{c.emoji}</div>
              <div>
                <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{c.label}</div>
                <div style={{ fontSize:11, fontWeight:600, color:T.muted, marginTop:2 }}>{c.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background:T.ink, padding:"36px 24px" }}>
        <div className="stats-grid" style={{ maxWidth:1000, margin:"0 auto",
          display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:24 }}>
          {[
            { value:"\u20b90", label:"Setup cost" },
            { value:"30s", label:"To get started" },
            { value:"100%", label:"UPI compatible" },
            { value:"24/7", label:"Access anywhere" },
          ].map(s => (
            <div key={s.label} style={{ textAlign:"center" }}>
              <div style={{ fontSize:"clamp(28px,5vw,40px)", fontWeight:900, color:T.saffron,
                fontFamily:"Montserrat,sans-serif" }}>{s.value}</div>
              <div style={{ fontSize:13, fontWeight:600, color:"#C8B89A", marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"72px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:48 }}>
          <h2 style={{ fontSize:"clamp(22px,5vw,36px)", fontWeight:900, color:T.ink,
            letterSpacing:"-.3px", marginBottom:12, fontFamily:"Montserrat,sans-serif" }}>
            Everything you need to manage rent
          </h2>
          <p style={{ fontSize:15, color:T.ink2, fontWeight:500, maxWidth:460, margin:"0 auto" }}>
            From collection to compliance — RentAI handles it all.
          </p>
        </div>
        <div className="features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {[
            { icon:"\ud83d\udcb0", title:"Automated Rent Collection", desc:"UPI-powered collection with auto-reminders before due dates.", color:T.saffron, bg:T.saffronL },
            { icon:"\ud83d\udcc8", title:"AI Financial Insights", desc:"Know your true P&L, vacancy costs, and growth opportunities.", color:T.teal, bg:T.tealL },
            { icon:"\ud83d\udd14", title:"Smart Reminders", desc:"Automatic reminders sent to tenants before due dates.", color:T.rose, bg:T.roseL },
            { icon:"\ud83c\udfd8\ufe0f", title:"Multi-Property Dashboard", desc:"All your properties and units in one clean view.", color:T.amber, bg:T.amberL },
            { icon:"\ud83d\udccb", title:"Tenant Management", desc:"Store tenant profiles, documents, and communication history.", color:T.plum, bg:T.plumL },
            { icon:"\ud83d\udd27", title:"Maintenance Tracking", desc:"Log, assign, and resolve maintenance requests effortlessly.", color:T.teal, bg:T.tealL },
          ].map(f => (
            <div key={f.title} className="feature-card" style={{ background:T.surface,
              border:"1px solid "+T.border, borderRadius:18, padding:"24px 22px",
              boxShadow:"0 2px 8px rgba(44,36,22,.05)" }}>
              <div style={{ width:46, height:46, borderRadius:12, background:f.bg,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:22, marginBottom:14 }}>{f.icon}</div>
              <h3 style={{ fontSize:14, fontWeight:800, color:T.ink, marginBottom:7,
                fontFamily:"Montserrat,sans-serif" }}>{f.title}</h3>
              <p style={{ fontSize:13, color:T.ink2, lineHeight:1.65, fontWeight:500 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background:T.panel, padding:"72px 24px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:48 }}>
            <h2 style={{ fontSize:"clamp(22px,5vw,36px)", fontWeight:900, color:T.ink,
              letterSpacing:"-.3px", marginBottom:12, fontFamily:"Montserrat,sans-serif" }}>
              Up and running in 3 steps
            </h2>
          </div>
          <div className="steps-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:28 }}>
            {[
              { n:"1", title:"Sign up with Email", desc:"Enter your email, get an OTP — you're in within 30 seconds." },
              { n:"2", title:"Add properties & units", desc:"Set rent amounts, due dates, and invite your tenants." },
              { n:"3", title:"Collect rent effortlessly", desc:"Tenants pay via UPI. You see it confirmed in real time." },
            ].map(s => (
              <div key={s.n} style={{ textAlign:"center" }}>
                <div style={{ width:56, height:56, borderRadius:16, margin:"0 auto 18px",
                  background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:22, fontWeight:900, color:"#fff", fontFamily:"Montserrat,sans-serif",
                  boxShadow:"0 6px 18px "+T.saffron+"40" }}>{s.n}</div>
                <h3 style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:9,
                  fontFamily:"Montserrat,sans-serif" }}>{s.title}</h3>
                <p style={{ fontSize:13, color:T.ink2, lineHeight:1.7, fontWeight:500 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"72px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h2 style={{ fontSize:"clamp(22px,5vw,36px)", fontWeight:900, color:T.ink,
            letterSpacing:"-.3px", marginBottom:12, fontFamily:"Montserrat,sans-serif" }}>
            Simple, transparent pricing
          </h2>
          <p style={{ fontSize:14, color:T.ink2, fontWeight:500, marginBottom:24 }}>Save 20% with yearly billing</p>
          <div style={{ display:"inline-flex", alignItems:"center", gap:12,
            background:T.panel, border:"1px solid "+T.border, borderRadius:30, padding:"4px 6px" }}>
            <button onClick={() => setYearly(false)} className="toggle-pill"
              style={{ padding:"7px 20px", borderRadius:24, fontSize:13, fontWeight:800,
                border:"none", cursor:"pointer",
                background: !yearly ? T.saffron : "transparent",
                color: !yearly ? "#ffffff" : T.ink2 }}>Monthly</button>
            <button onClick={() => setYearly(true)} className="toggle-pill"
              style={{ padding:"7px 20px", borderRadius:24, fontSize:13, fontWeight:800,
                border:"none", cursor:"pointer",
                background: yearly ? T.saffron : "transparent",
                color: yearly ? "#ffffff" : T.ink2 }}>Yearly</button>
          </div>
        </div>
        <div className="plans-grid" style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fit,minmax(175px,1fr))", gap:16 }}>
          {PLANS.map(p => (
            <div key={p.name} className="plan-card" style={{ background:T.surface,
              border: p.highlight ? "2px solid "+T.saffron : "1px solid "+T.border,
              borderRadius:20, padding:"24px 18px", position:"relative",
              boxShadow: p.highlight ? "0 8px 32px "+T.saffron+"25" : "0 2px 8px rgba(44,36,22,.05)" }}>
              {p.highlight && (
                <div style={{ position:"absolute", top:-12, left:"50%", transform:"translateX(-50%)",
                  background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
                  color:"#ffffff", fontSize:10, fontWeight:900, padding:"4px 14px",
                  borderRadius:20, whiteSpace:"nowrap" }}>\u2b50 Most Popular</div>
              )}
              <div style={{ width:38, height:38, borderRadius:10, background:p.bg,
                display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:16, marginBottom:12, border:"1px solid "+p.color+"30" }}>
                <span style={{ color:p.color, fontWeight:900, fontSize:14 }}>{p.name[0]}</span>
              </div>
              <h3 style={{ fontSize:15, fontWeight:900, color:T.ink, marginBottom:4,
                fontFamily:"Montserrat,sans-serif" }}>{p.name}</h3>
              <div style={{ fontSize:20, fontWeight:900, color:p.color, marginBottom:4,
                fontFamily:"Montserrat,sans-serif" }}>{yearly ? p.yearlyLabel : p.monthlyLabel}</div>
              <div style={{ fontSize:11, color:T.muted, fontWeight:600, marginBottom:12 }}>{p.unitLimit}</div>
              <p style={{ fontSize:11, color:T.ink2, lineHeight:1.6, marginBottom:14, fontWeight:500 }}>{p.desc}</p>
              <ul style={{ listStyle:"none", marginBottom:18 }}>
                {p.features.map(f => (
                  <li key={f} style={{ fontSize:11, color:T.ink2, fontWeight:600,
                    padding:"3px 0", display:"flex", alignItems:"center", gap:6 }}>
                    <span style={{ color:T.teal, fontSize:10 }}>\u2713</span> {f}
                  </li>
                ))}
              </ul>
              <button onClick={() => p.name==="Business"
                  ? window.open("mailto:support@rentai.co.in","_blank") : onGetStarted()}
                style={{ width:"100%", padding:"10px 0", borderRadius:11, fontSize:12,
                  fontWeight:800, cursor:"pointer",
                  background: p.highlight ? "linear-gradient(135deg,"+T.saffron+","+T.saffronB+")" : p.bg,
                  color: p.highlight ? "#ffffff" : p.color,
                  border: p.highlight ? "none" : "1.5px solid "+p.color+"40" }}>
                {p.cta}
              </button>
              <div style={{ fontSize:10, color:T.muted, textAlign:"center", marginTop:7, fontWeight:600 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ background:T.panel, padding:"72px 24px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:40 }}>
            <div style={{ display:"inline-flex", alignItems:"center", gap:7,
              background:T.tealL, border:"1.5px solid "+T.teal+"30", borderRadius:30,
              padding:"6px 16px", marginBottom:20, fontSize:12, fontWeight:800, color:T.teal }}>
              \ud83c\udfaf Professional Services
            </div>
            <h2 style={{ fontSize:"clamp(22px,5vw,34px)", fontWeight:900, color:T.ink,
              letterSpacing:"-.3px", marginBottom:12, fontFamily:"Montserrat,sans-serif" }}>
              Need hands-on help?
            </h2>
            <p style={{ fontSize:14, color:T.ink2, fontWeight:500, maxWidth:440, margin:"0 auto" }}>
              Our experts handle the heavy lifting — from onboarding to legal to maintenance.
            </p>
          </div>
          <div className="svc-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:16, marginBottom:36 }}>
            {SERVICES.map(s => (
              <div key={s.title} className="svc-card" style={{ background:T.surface,
                border:"1px solid "+T.border, borderRadius:16, padding:"20px 18px",
                boxShadow:"0 2px 8px rgba(44,36,22,.05)" }}>
                <div style={{ fontSize:26, marginBottom:10 }}>{s.icon}</div>
                <h3 style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:6,
                  fontFamily:"Montserrat,sans-serif" }}>{s.title}</h3>
                <p style={{ fontSize:12, color:T.ink2, lineHeight:1.65, fontWeight:500 }}>{s.desc}</p>
              </div>
            ))}
          </div>
          <div style={{ textAlign:"center" }}>
            <button onClick={() => onServices && onServices()}
              style={{ padding:"13px 32px", borderRadius:13, fontSize:14, fontWeight:900,
                border:"2px solid "+T.teal, background:"transparent", color:T.teal, cursor:"pointer" }}>
              View All Services \u2192
            </button>
          </div>
        </div>
      </section>
      <section style={{ maxWidth:1000, margin:"0 auto", padding:"72px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <h2 style={{ fontSize:"clamp(22px,5vw,34px)", fontWeight:900, color:T.ink,
            letterSpacing:"-.3px", fontFamily:"Montserrat,sans-serif" }}>
            Loved by landlords across India
          </h2>
        </div>
        <div className="testimonials-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:20 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background:T.surface, border:"1px solid "+T.border,
              borderRadius:18, padding:"24px 20px", boxShadow:"0 2px 8px rgba(44,36,22,.05)" }}>
              <div style={{ display:"flex", gap:3, marginBottom:14 }}>
                {[...Array(t.rating)].map((_,i) => (
                  <span key={i} style={{ color:T.saffron, fontSize:14 }}>\u2605</span>
                ))}
              </div>
              <p style={{ fontSize:13, color:T.ink2, lineHeight:1.75, fontWeight:500,
                marginBottom:16, fontStyle:"italic" }}>"{t.text}"</p>
              <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{t.name}</div>
              <div style={{ fontSize:11, color:T.muted, fontWeight:600 }}>{t.role}</div>
            </div>
          ))}
        </div>
      </section>
      <section style={{ padding:"0 24px 72px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto",
          background:"linear-gradient(135deg,"+T.saffronL+","+T.tealL+")",
          border:"2px solid "+T.saffron+"20", borderRadius:24, padding:"52px 28px", textAlign:"center" }}>
          <div style={{ fontSize:44, marginBottom:16 }}>\ud83c\udfe1</div>
          <h2 style={{ fontSize:"clamp(20px,5vw,32px)", fontWeight:900, color:T.ink,
            letterSpacing:"-.3px", marginBottom:12, fontFamily:"Montserrat,sans-serif" }}>
            Start managing smarter today
          </h2>
          <p style={{ fontSize:14, color:T.ink2, fontWeight:600, maxWidth:400,
            margin:"0 auto 28px", lineHeight:1.75 }}>
            Join landlords across India who've switched from WhatsApp chaos to RentAI's clean dashboard.
          </p>
          <button onClick={onGetStarted} className="cta-btn"
            style={{ padding:"15px 36px", borderRadius:14, fontSize:16, fontWeight:900,
              border:"none", color:"#ffffff", cursor:"pointer",
              background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+","+T.amber+")",
              boxShadow:"0 6px 20px "+T.saffron+"40" }}>
            Get Started Free \u2192
          </button>
          <div style={{ marginTop:16, fontSize:12, color:T.muted, fontWeight:600 }}>
            Free forever plan available. No credit card required.
          </div>
        </div>
      </section>
      <footer style={{ background:T.ink, padding:"48px 24px 28px" }}>
        <div style={{ maxWidth:1000, margin:"0 auto" }}>
          <div className="footer-grid" style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr 1fr", gap:32, marginBottom:36 }}>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:16 }}>
                <div style={{ width:34, height:34, borderRadius:9,
                  background:"linear-gradient(135deg,"+T.saffron+","+T.saffronB+")",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:18 }}>\ud83c\udfe1</div>
                <span style={{ fontSize:17, fontWeight:900, color:"#fff", fontFamily:"Montserrat,sans-serif" }}>RentAI</span>
              </div>
              <p style={{ fontSize:12, color:"#9B8B7A", lineHeight:1.75, fontWeight:500, maxWidth:240 }}>
                India's AI-powered rental management platform. Collect rent, track expenses, manage tenants.
              </p>
            </div>
            {[
              { head:"Product", links:["Features","Pricing","Services","Login"] },
              { head:"Company", links:["About","Blog","Careers","Contact"] },
              { head:"Legal", links:["Privacy Policy","Terms of Service","Refund Policy"] },
            ].map(col => (
              <div key={col.head}>
                <h4 style={{ fontSize:12, fontWeight:800, color:"#C8B89A", marginBottom:14,
                  letterSpacing:".5px", textTransform:"uppercase", fontFamily:"Montserrat,sans-serif" }}>{col.head}</h4>
                {col.links.map(l => (
                  <div key={l} style={{ fontSize:12, color:"#9B8B7A", fontWeight:600, marginBottom:9, cursor:"pointer" }}>{l}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop:"1px solid #3C3426", paddingTop:20,
            display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ fontSize:11, color:"#6B5A4A", fontWeight:600 }}>\u00a9 2025 RentAI. Made with \u2764\ufe0f in India.</div>
            <div style={{ fontSize:11, color:"#6B5A4A", fontWeight:600 }}>support@rentai.co.in</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
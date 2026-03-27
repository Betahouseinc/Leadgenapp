import { Link } from "react-router-dom";

const T = {
  bg:"#FAFAF7", surface:"#FFFFFF", panel:"#F5F3EE",
  border:"#E8E4DC", border2:"#D4CFC4",
  ink:"#2C2416", ink2:"#5C5240", muted:"#9C8E7A",
  saffron:"#E8821A", saffronL:"#FDF0E0", saffronB:"#F5A650",
  teal:"#1A8A72", tealL:"#E0F5F0",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; font-family: 'Nunito', 'Segoe UI', sans-serif; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
  .fu { animation: fadeUp .4s ease both; }
`;

const sections = [
  {
    icon: "🏠",
    heading: "Built from Real Rental Challenges",
    color: T.saffron,
    bg: T.saffronL,
    body: "RentAI was built after closely observing the everyday struggles of managing rental properties. From tracking rent payments and due dates to constant follow-ups and scattered records — the process is often more complicated than it should be.",
    subheading: "But this challenge isn't limited to property owners. Tenants face it too:",
    bullets: [
      "Lack of clarity on payments",
      "Repeated communication and reminders",
      "Limited transparency in records",
    ],
    footer: "When multiple people are involved, even simple things can become confusing — sometimes leading to unnecessary friction.",
  },
  {
    icon: "💡",
    heading: "Why RentAI Exists",
    color: T.teal,
    bg: T.tealL,
    body: "RentAI exists to simplify rental management for everyone involved.",
    subheading: "The goal is to:",
    bullets: [
      "Reduce manual effort and constant follow-ups",
      "Bring clarity to rent tracking and payments",
      "Minimize miscommunication between owners and tenants",
      "Create a smoother, more transparent experience",
    ],
  },
  {
    icon: "🚀",
    heading: "What RentAI Does",
    color: T.saffron,
    bg: T.saffronL,
    body: "RentAI brings everything into one place, so you can manage rentals with confidence:",
    bullets: [
      "Track rent, due dates, and payment status",
      "Manage multiple properties without confusion",
      "Keep records organized and easily accessible",
      "Stay updated without relying on manual tracking",
    ],
    footer: "Everything you need — right at your fingertips.",
  },
  {
    icon: "👥",
    heading: "Designed for Real-World Use",
    color: T.teal,
    bg: T.tealL,
    body: "Rental ecosystems aren't one-sided, and RentAI reflects that.",
    subheading: "It's built for:",
    bullets: [
      "Property owners managing one or multiple units",
      "Tenants who want clarity and transparency",
      "Users who play both roles",
    ],
    footer: "Because better systems benefit everyone involved.",
  },
  {
    icon: "🌱",
    heading: "Our Vision",
    color: T.saffron,
    bg: T.saffronL,
    body: "We believe rental management should be:",
    bullets: ["Simple", "Transparent", "Stress-free"],
    footer: "RentAI is just the beginning. We're building a platform that reduces friction, improves clarity, and makes managing rentals effortless — no matter how many people or properties are involved.",
  },
  {
    icon: "🤝",
    heading: "Built with Real Feedback",
    color: T.teal,
    bg: T.tealL,
    body: "RentAI is currently in its early stages and is actively evolving based on real user feedback. Every feature is shaped by real problems and real experiences.",
  },
];

export default function About() {
  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg, minHeight:"100vh" }}>
      <style>{CSS}</style>

      {/* Nav */}
      <nav style={{ background:T.surface, borderBottom:`1px solid ${T.border}`, padding:"12px 20px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:50 }}>
        <Link to="/" style={{ display:"flex", alignItems:"center", gap:8, textDecoration:"none" }}>
          <div style={{ width:28, height:28, borderRadius:8,
            background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14 }}>🔑</div>
          <span style={{ fontWeight:900, fontSize:14, color:T.ink }}>RentAI</span>
        </Link>
        <Link to="/" style={{ fontSize:12, fontWeight:700, color:T.muted, textDecoration:"none" }}>← Back</Link>
      </nav>

      {/* Hero */}
      <div className="fu" style={{ textAlign:"center", padding:"48px 24px 32px", maxWidth:680, margin:"0 auto" }}>
        <div style={{ display:"inline-flex", alignItems:"center", gap:6, background:T.saffronL,
          border:`1px solid ${T.saffron}30`, borderRadius:20, padding:"5px 14px",
          fontSize:11, fontWeight:800, color:T.saffron, marginBottom:16, letterSpacing:.4 }}>
          🇮🇳 BUILT FOR INDIA
        </div>
        <h1 style={{ fontSize:32, fontWeight:900, color:T.ink, letterSpacing:-1, lineHeight:1.2, marginBottom:12 }}>
          About <span style={{ color:T.saffron }}>RentAI</span>
        </h1>
        <p style={{ fontSize:14, color:T.ink2, lineHeight:1.8, maxWidth:500, margin:"0 auto" }}>
          Bringing clarity, confidence, and ease to rental management — for owners and tenants alike.
        </p>
      </div>

      {/* Sections */}
      <div style={{ maxWidth:680, margin:"0 auto", padding:"0 20px 64px" }}>
        {sections.map((s, i) => (
          <div key={i} className="fu" style={{ marginBottom:20,
            background:T.surface, border:`1.5px solid ${T.border}`, borderRadius:18,
            overflow:"hidden", animationDelay:`${i * 0.07}s` }}>
            {/* Section header */}
            <div style={{ background:s.bg, padding:"16px 20px",
              display:"flex", alignItems:"center", gap:12,
              borderBottom:`1px solid ${s.color}20` }}>
              <span style={{ fontSize:28 }}>{s.icon}</span>
              <h2 style={{ fontSize:16, fontWeight:900, color:s.color, letterSpacing:-0.3 }}>
                {s.heading}
              </h2>
            </div>

            {/* Section body */}
            <div style={{ padding:"16px 20px" }}>
              {s.body && (
                <p style={{ fontSize:13, color:T.ink2, lineHeight:1.8, marginBottom: (s.subheading || s.bullets) ? 12 : 0 }}>
                  {s.body}
                </p>
              )}
              {s.subheading && (
                <p style={{ fontSize:13, fontWeight:700, color:T.ink, marginBottom:8 }}>
                  {s.subheading}
                </p>
              )}
              {s.bullets && (
                <ul style={{ paddingLeft:0, listStyle:"none", marginBottom:s.footer ? 12 : 0 }}>
                  {s.bullets.map((b, j) => (
                    <li key={j} style={{ display:"flex", alignItems:"flex-start", gap:8,
                      fontSize:13, color:T.ink2, lineHeight:1.7, marginBottom:4 }}>
                      <span style={{ color:s.color, fontWeight:900, marginTop:2 }}>→</span>
                      {b}
                    </li>
                  ))}
                </ul>
              )}
              {s.footer && (
                <p style={{ fontSize:13, color:T.muted, fontStyle:"italic", lineHeight:1.7 }}>
                  {s.footer}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Closing statement */}
        <div style={{ textAlign:"center", padding:"24px 20px", background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
          borderRadius:18, color:"#fff" }}>
          <div style={{ fontSize:22, marginBottom:8 }}>🔑</div>
          <div style={{ fontSize:16, fontWeight:900, letterSpacing:-0.3, marginBottom:6 }}>
            RentAI
          </div>
          <div style={{ fontSize:13, opacity:.9, lineHeight:1.6 }}>
            Bringing clarity, confidence, and ease to rental management.
          </div>
          <Link to="/" style={{ display:"inline-block", marginTop:16, padding:"10px 24px",
            background:"rgba(255,255,255,.2)", border:"1.5px solid rgba(255,255,255,.4)",
            borderRadius:10, fontSize:13, fontWeight:800, color:"#fff", textDecoration:"none" }}>
            Get Started Free →
          </Link>
        </div>

        {/* Footer links */}
        <div style={{ marginTop:32, display:"flex", gap:16, flexWrap:"wrap", justifyContent:"center" }}>
          {[
            { label:"Privacy Policy", href:"/legal/privacy" },
            { label:"Terms of Use", href:"/legal/terms" },
            { label:"Security", href:"/legal/security" },
            { label:"Data Protection", href:"/legal/data-protection" },
          ].map(l => (
            <a key={l.href} href={l.href}
              style={{ fontSize:11, fontWeight:700, color:T.muted, textDecoration:"none" }}>
              {l.label}
            </a>
          ))}
        </div>
        <div style={{ textAlign:"center", marginTop:12, fontSize:11, color:T.muted, fontWeight:600 }}>
          © {new Date().getFullYear()} RentAI · Built for Indian property owners · 🇮🇳
        </div>
      </div>
    </div>
  );
}

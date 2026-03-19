import { useState, useEffect, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

// ── SUPABASE CONFIG ──────────────────────────────────────────
// Replace with your actual values from Supabase → Settings → API
const SUPABASE_URL  = "https://xcjakihewzegzyumnyuw.supabase.co";
const SUPABASE_ANON = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhjamFraWhld3plZ3p5dW1ueXV3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2ODcyNDIsImV4cCI6MjA4OTI2MzI0Mn0.HLwaK6PDdMap8SQ5ODz5XNSCKbCNnHkilO3HeuSVdyc";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── TWILIO CONFIG (via Supabase Edge Function) ───────────────
// We'll call a Supabase Edge Function to send WhatsApp OTP
// No Twilio keys exposed in frontend
const SEND_OTP_FN = `${SUPABASE_URL}/functions/v1/send-otp`;

const T = {
  bg:"#FAFAF7", surface:"#FFFFFF", panel:"#F5F3EE", card:"#FFFFFF",
  border:"#E8E4DC", border2:"#D4CFC4",
  ink:"#2C2416", ink2:"#5C5240", muted:"#9C8E7A", subtle:"#C4BAA8",
  saffron:"#E8821A", saffronL:"#FDF0E0", saffronB:"#F5A650",
  teal:"#1A8A72", tealL:"#E0F5F0", tealB:"#2AB394",
  amber:"#D4A017", amberL:"#FDF8E0",
  rose:"#C44B4B", roseL:"#FDEAEA",
  sky:"#2D7DD2", skyL:"#E8F2FC",
  plum:"#7C3AED", plumL:"#EDE9FE",
  green:"#2E7D32", greenL:"#E8F5E9",
};

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; }
  button { cursor: pointer; font-family: inherit; }
  input, select, textarea { outline: none; font-family: inherit; }
  ::-webkit-scrollbar { width: 4px; }
  ::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 2px; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
  @keyframes toastIn { from { opacity:0; transform:translateX(-50%) translateY(10px) } to { opacity:1; transform:translateX(-50%) translateY(0) } }
  @keyframes spin { to { transform: rotate(360deg) } }
  .fu { animation: fadeUp .35s ease both; }
  .spin { animation: spin 1s linear infinite; }
`;

const fd = (n) => "₹" + Number(n||0).toLocaleString("en-IN");
const fmt = (d) => d ? new Date(d).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "—";

// ── REUSABLE COMPONENTS ──────────────────────────────────────
const Chip = ({ label, color }) => (
  <span style={{ fontSize:10, fontWeight:700, padding:"2px 8px", borderRadius:20,
    background:`${color}18`, color, border:`1px solid ${color}30` }}>{label}</span>
);

const Spinner = () => (
  <div className="spin" style={{ width:20, height:20, border:`3px solid ${T.border2}`,
    borderTopColor:T.saffron, borderRadius:"50%", display:"inline-block" }}/>
);

const Toast = ({ msg }) => msg ? (
  <div style={{ position:"fixed", bottom:28, left:"50%", transform:"translateX(-50%)",
    padding:"11px 24px", borderRadius:13, background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
    color:"#fff", fontWeight:800, fontSize:13, zIndex:9999, whiteSpace:"nowrap",
    animation:"toastIn .25s ease", boxShadow:`0 8px 28px ${T.saffron}35` }}>{msg}</div>
) : null;

// ── UPI PAY MODAL ────────────────────────────────────────────
function UPIPayModal({ payment, tenant, onClose, onPaid }) {
  const [step, setStep] = useState("choose"); // choose | confirm
  const [utr, setUtr] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [utrError, setUtrError] = useState("");

  const upiId = "rentoksupport@oksbi";
  const amount = payment.amount;
  const name = encodeURIComponent("RentAI");
  const note = encodeURIComponent(`${payment.type} - ${tenant.name}`);
  const upiLink = `upi://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}`;

  const apps = [
    { label:"Google Pay",   icon:"🟢", pkg:"com.google.android.apps.nbu.paisa.user",
      url:`gpay://upi/pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}` },
    { label:"PhonePe",      icon:"🟣", pkg:"com.phonepe.app",
      url:`phonepe://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}` },
    { label:"Paytm",        icon:"🔵", pkg:"net.one97.paytm",
      url:`paytmmp://pay?pa=${upiId}&pn=${name}&am=${amount}&cu=INR&tn=${note}` },
    { label:"BHIM / Any UPI", icon:"🇮🇳", pkg:"",
      url: upiLink },
  ];

  const submitUtr = async () => {
    const clean = utr.trim().replace(/\s/g,"");
    if(clean.length < 10) { setUtrError("Please enter a valid UTR / transaction ID (min 10 chars)"); return; }
    setSubmitting(true); setUtrError("");
    try {
      await supabase.from("payments").update({
        status: "verification_pending",
        utr_number: clean,
        paid_date: new Date().toISOString().split("T")[0],
      }).eq("id", payment.id);
      onPaid();
    } catch(e) {
      setUtrError("Could not save. Please try again.");
    }
    setSubmitting(false);
  };

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9000,
      background:"rgba(0,0,0,.55)", display:"flex", alignItems:"flex-end",
      justifyContent:"center" }} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div className="fu" style={{ background:T.surface, borderRadius:"22px 22px 0 0",
        width:"100%", maxWidth:520, padding:"24px 20px 36px",
        boxShadow:"0 -8px 40px rgba(0,0,0,.18)" }}>

        {/* Handle bar */}
        <div style={{ width:40, height:4, borderRadius:2, background:T.border2,
          margin:"0 auto 20px", opacity:.5 }}/>

        {step === "choose" && (
          <>
            <div style={{ fontSize:17, fontWeight:900, color:T.ink, marginBottom:4 }}>
              Pay {fd(amount)}
            </div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>
              {payment.type} · UPI ID: <span style={{ color:T.ink, fontWeight:700 }}>{upiId}</span>
            </div>

            {/* QR placeholder — links to any UPI app */}
            <a href={upiLink} style={{ display:"block", textDecoration:"none" }}>
              <div style={{ background:T.panel, border:`2px dashed ${T.border2}`,
                borderRadius:16, padding:"18px 12px", marginBottom:18, textAlign:"center" }}>
                <div style={{ fontSize:48, marginBottom:6 }}>📲</div>
                <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>Tap to open UPI app</div>
                <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>Opens your default UPI app</div>
              </div>
            </a>

            {/* App buttons */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:9, marginBottom:20 }}>
              {apps.map(app => (
                <a key={app.label} href={app.url}
                  style={{ display:"flex", alignItems:"center", gap:9, padding:"11px 13px",
                    background:T.panel, border:`1.5px solid ${T.border2}`, borderRadius:13,
                    textDecoration:"none", cursor:"pointer" }}>
                  <span style={{ fontSize:22 }}>{app.icon}</span>
                  <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>{app.label}</span>
                </a>
              ))}
            </div>

            <button onClick={()=>setStep("confirm")}
              style={{ width:"100%", padding:"13px", background:T.teal, border:"none",
                borderRadius:13, fontSize:14, fontWeight:800, color:"#fff", cursor:"pointer" }}>
              ✅ I've paid — Enter UTR →
            </button>
            <button onClick={onClose}
              style={{ width:"100%", marginTop:9, padding:"11px", background:"none",
                border:`1.5px solid ${T.border2}`, borderRadius:13, fontSize:13,
                fontWeight:700, color:T.muted, cursor:"pointer" }}>
              Cancel
            </button>
          </>
        )}

        {step === "confirm" && (
          <>
            <div style={{ fontSize:17, fontWeight:900, color:T.ink, marginBottom:4 }}>
              Confirm Payment
            </div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:20 }}>
              Enter the UTR / Transaction ID from your UPI app
            </div>

            <div style={{ background:T.tealL, border:`1px solid ${T.teal}25`,
              borderRadius:12, padding:"11px 13px", marginBottom:16,
              fontSize:12, color:T.teal, fontWeight:600 }}>
              📍 Find UTR in your UPI app under "Transaction Details" or "Payment History"
            </div>

            <div style={{ fontSize:10, fontWeight:700, color:T.muted,
              letterSpacing:.5, textTransform:"uppercase", marginBottom:7 }}>
              UTR / Transaction ID
            </div>
            <input
              value={utr}
              onChange={e=>{ setUtr(e.target.value); setUtrError(""); }}
              placeholder="e.g. 402612345678 or T2506XXXXXX"
              style={{ width:"100%", background:T.panel, border:`1.5px solid ${utrError?T.rose:T.border2}`,
                color:T.ink, borderRadius:11, padding:"12px 14px", fontSize:14,
                fontWeight:700, boxSizing:"border-box", letterSpacing:.3 }}
            />
            {utrError && (
              <div style={{ color:T.rose, fontSize:12, marginTop:7, fontWeight:600 }}>{utrError}</div>
            )}

            <button onClick={submitUtr} disabled={submitting}
              style={{ width:"100%", marginTop:16, padding:"13px",
                background:`linear-gradient(135deg,${T.teal},${T.tealB})`,
                border:"none", borderRadius:13, fontSize:14, fontWeight:800,
                color:"#fff", cursor:"pointer", display:"flex",
                alignItems:"center", justifyContent:"center", gap:8 }}>
              {submitting ? <Spinner/> : "Submit for Verification →"}
            </button>
            <button onClick={()=>setStep("choose")}
              style={{ width:"100%", marginTop:9, padding:"11px", background:"none",
                border:`1.5px solid ${T.border2}`, borderRadius:13, fontSize:13,
                fontWeight:700, color:T.muted, cursor:"pointer" }}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── PHONE INPUT COMPONENT ────────────────────────────────────
const PhoneInput = ({ value, onChange, disabled }) => (
  <div style={{ display:"flex", border:`1.5px solid ${T.border2}`, borderRadius:12,
    overflow:"hidden", background:T.panel }}>
    <div style={{ padding:"12px 14px", background:T.surface, borderRight:`1px solid ${T.border2}`,
      fontSize:14, fontWeight:700, color:T.ink2, whiteSpace:"nowrap" }}>🇮🇳 +91</div>
    <input
      type="tel" value={value} onChange={e => onChange(e.target.value.replace(/\D/g,"").slice(0,10))}
      placeholder="WhatsApp number" disabled={disabled}
      style={{ flex:1, padding:"12px 14px", background:"transparent", border:"none",
        fontSize:15, fontWeight:700, color:T.ink, letterSpacing:.5 }}
    />
  </div>
);

// ── OTP INPUT COMPONENT ──────────────────────────────────────
const OtpInput = ({ value, onChange }) => (
  <div style={{ display:"flex", gap:10, justifyContent:"center" }}>
    {[0,1,2,3,4,5].map(i => (
      <input key={i} id={`otp-${i}`} type="tel" maxLength={1}
        value={value[i]||""} onChange={e => {
          const v = e.target.value.replace(/\D/,"");
          const arr = value.split("");
          arr[i] = v;
          onChange(arr.join(""));
          if(v && i < 5) document.getElementById(`otp-${i+1}`)?.focus();
        }}
        onKeyDown={e => { if(e.key==="Backspace" && !value[i] && i > 0) document.getElementById(`otp-${i-1}`)?.focus(); }}
        style={{ width:44, height:52, textAlign:"center", fontSize:22, fontWeight:900,
          border:`2px solid ${value[i]?T.saffron:T.border2}`, borderRadius:12,
          background:value[i]?T.saffronL:T.surface, color:T.ink, fontFamily:"inherit",
          transition:"all .15s" }}
      />
    ))}
  </div>
);

// ══════════════════════════════════════════════════════════════
// LOGIN SCREEN
// ══════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [step, setStep] = useState("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [name, setName] = useState("");
  const [city, setCity] = useState("Bengaluru");
  const [role, setRole] = useState("owner");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendTimer, setResendTimer] = useState(0);
  const [sessionId, setSessionId] = useState(null);
  const [otpSentAt, setOtpSentAt] = useState(null); // timestamp when OTP was sent

  useEffect(() => {
    if(resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r-1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  const sendOtp = async () => {
    if(phone.length !== 10) { setError("Enter a valid 10-digit WhatsApp number"); return; }
    setLoading(true); setError("");
    try {
      const arr = new Uint32Array(1);
      crypto.getRandomValues(arr);
      const code    = String(arr[0] % 1000000).padStart(6, "0");
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();

      // Invalidate old OTPs
      await supabase.from("otp_sessions")
        .update({ used: true })
        .eq("phone", `+91${phone}`)
        .eq("used", false);

      // Save OTP to DB
      const sentAt = new Date().toISOString();
      const { error: insertErr } = await supabase.from("otp_sessions")
        .insert({ phone: `+91${phone}`, otp_code: code, expires_at: expires });

      if(insertErr) {
        setError("DB error: " + insertErr.message);
        setLoading(false);
        return;
      }

      setOtpSentAt(sentAt);

      // Send WhatsApp via Edge Function (fire and forget)
      fetch(`${SUPABASE_URL}/functions/v1/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: `+91${phone}`, code }),
      }).catch(() => {});

      setStep("otp");
      setResendTimer(30);
    } catch(e) {
      setError("Error: " + (e?.message || "unknown"));
    }
    setLoading(false);
  };

  const verifyOtp = async () => {
    if(otp.length !== 6) { setError("Enter the 6-digit OTP"); return; }
    if(!/^\d{6}$/.test(otp)) { setError("OTP must be 6 digits"); return; }
    setLoading(true); setError("");
    try {

      // ── Demo account bypass ──────────────────────────────────
      // Only works for phones marked is_demo=true in demo_accounts table
      if(otp === "123456") {
        const { data: demoRow } = await supabase
          .from("demo_accounts")
          .select("*")
          .eq("phone", `+91${phone}`)
          .eq("is_active", true)
          .maybeSingle();

        if(!demoRow) {
          setError("Incorrect OTP. Please try again.");
          setLoading(false);
          return;
        }
        // Demo account verified — fall through to role check below
      } else {
        // Normal OTP verification
        const { data: sessions, error: readErr } = await supabase
          .from("otp_sessions")
          .select("*")
          .eq("phone", `+91${phone}`)
          .eq("used", false)
          .order("created_at", { ascending: false })
          .limit(1);

        if(readErr) { setError("DB read error: " + readErr.message); setLoading(false); return; }

        const session = sessions?.[0];
        if(!session) { setError("OTP not found. Please request a new one."); setLoading(false); return; }
        if(new Date(session.expires_at) < new Date()) { setError("OTP expired. Please request a new one."); setLoading(false); return; }
        if(String(session.otp_code).trim() !== String(otp).trim()) { setError("Incorrect OTP. Please try again."); setLoading(false); return; }

        await supabase.from("otp_sessions").update({ used: true }).eq("id", session.id);
      }

      // Check if admin
      try {
        const { data: adminRow } = await supabase
          .from("admin_phones").select("*")
          .eq("phone", `+91${phone}`).eq("is_active", true).maybeSingle();
        if(adminRow) { onLogin({ type:"admin", phone:`+91${phone}`, name:adminRow.name, role:adminRow.role }); return; }
      } catch(_) {}

      // Check if owner
      const { data: existingOwner, error: ownerErr } = await supabase
        .from("owners").select("*").eq("phone", `+91${phone}`).maybeSingle();
      if(ownerErr) { setError("Owner lookup error: " + ownerErr.message); setLoading(false); return; }
      if(existingOwner) { onLogin({ type:"owner", ...existingOwner }); return; }

      // Check if tenant
      const { data: existingTenant } = await supabase
        .from("tenants").select("*, units(*, properties(*))").eq("phone", `+91${phone}`).eq("is_active", true).maybeSingle();
      if(existingTenant) { onLogin({ type:"tenant", ...existingTenant }); return; }

      setStep("role");
    } catch(e) {
      setError("Verification failed. Please try again.");
    }
    setLoading(false);
  };


  const createProfile = async () => {
    if(!name.trim()) { setError("Please enter your name"); return; }
    setLoading(true); setError("");
    try {
      if(role === "owner") {
        const { data: owner, error: insertErr } = await supabase
          .from("owners")
          .insert({ phone:`+91${phone}`, name:name.trim(), city, beta_user:true })
          .select("*").single();
        if(insertErr) throw insertErr;
        onLogin({ type:"owner", ...owner });
      } else {
        // Tenant self-registration — no unit assigned yet
        const { data: tenant, error: insertErr } = await supabase
          .from("tenants")
          .insert({ phone:`+91${phone}`, name:name.trim(), is_active:true, owner_id:null })
          .select("*").single();
        if(insertErr) throw insertErr;
        onLogin({ type:"tenant", ...tenant });
      }
    } catch(e) {
      setError("Could not create profile. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      padding:20 }}>
      <style>{CSS}</style>
      <div className="fu" style={{ width:"100%", maxWidth:400 }}>

        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:32 }}>
          <div style={{ width:64, height:64, borderRadius:20,
            background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:32, margin:"0 auto 12px", boxShadow:`0 8px 24px ${T.saffron}35` }}>🔑</div>
          <div style={{ fontSize:26, fontWeight:900, color:T.ink, letterSpacing:-.8 }}>RentAI</div>
          <div style={{ fontSize:13, color:T.muted, marginTop:4 }}>AI-powered Rent Management</div>
        </div>

        <div style={{ background:T.surface, borderRadius:20, padding:28,
          border:`1.5px solid ${T.border}`, boxShadow:"0 4px 24px rgba(0,0,0,.06)" }}>

          {/* STEP: PHONE */}
          {step === "phone" && (
            <>
              <div style={{ fontSize:18, fontWeight:900, color:T.ink, marginBottom:6 }}>Owner Login</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:24 }}>
                We'll send a 6-digit OTP to your WhatsApp
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:.5,
                textTransform:"uppercase", marginBottom:8 }}>WhatsApp Number</div>
              <PhoneInput value={phone} onChange={setPhone} disabled={loading}/>
              {error && <div style={{ color:T.rose, fontSize:12, marginTop:8, fontWeight:600 }}>{error}</div>}
              <button onClick={sendOtp} disabled={loading}
                style={{ width:"100%", marginTop:20, padding:14,
                  background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border:"none", borderRadius:12, fontSize:15, fontWeight:800,
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading ? <Spinner/> : "Send OTP on WhatsApp →"}
              </button>

              {/* Demo login buttons — quick fill for test accounts */}
              <div style={{ marginTop:20, padding:14, background:T.panel,
                border:`1.5px dashed ${T.border2}`, borderRadius:12 }}>
                <div style={{ fontSize:10, fontWeight:800, color:T.muted,
                  letterSpacing:.5, textTransform:"uppercase", marginBottom:10 }}>
                  🧪 Demo Accounts
                </div>
                <div style={{ display:"flex", gap:8 }}>
                  {[
                    { label:"👤 Owner", phone:"9999999999" },
                    { label:"🏠 Tenant", phone:"8888888888" },
                  ].map(d => (
                    <button key={d.phone} onClick={async () => {
                      setPhone(d.phone);
                      setLoading(true); setError("");
                      // Send OTP then auto-fetch and fill it
                      const arr = new Uint32Array(1);
                      crypto.getRandomValues(arr);
                      const code = String(arr[0] % 1000000).padStart(6, "0");
                      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
                      await supabase.from("otp_sessions").update({ used:true }).eq("phone",`+91${d.phone}`).eq("used",false);
                      await supabase.from("otp_sessions").insert({ phone:`+91${d.phone}`, otp_code:code, expires_at:expires });
                      setOtpSentAt(new Date().toISOString());
                      setStep("otp");
                      setResendTimer(30);
                      setOtp(code); // auto-fill OTP
                      setLoading(false);
                    }}
                      style={{ flex:1, padding:"9px 6px", background:T.surface,
                        border:`1.5px solid ${T.border2}`, borderRadius:10,
                        fontSize:12, fontWeight:800, color:T.ink2,
                        cursor:"pointer", fontFamily:"inherit" }}>
                      {d.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize:10, color:T.muted, marginTop:8, textAlign:"center" }}>
                  Auto-fills OTP · No WhatsApp needed
                </div>
              </div>

              <div style={{ textAlign:"center", marginTop:16, fontSize:12, color:T.muted }}>
                New to RentAI?{" "}
                <a href="https://docs.google.com/forms/d/e/1FAIpQLScd2tgV61wlCkJMfnQSOMa0ExM-c0ZpJVU1xOd6XD63Fs6pQA/viewform"
                  target="_blank" rel="noreferrer"
                  style={{ color:T.saffron, fontWeight:700, textDecoration:"none" }}>
                  Request beta access →
                </a>
              </div>
            </>
          )}

          {/* STEP: OTP */}
          {step === "otp" && (
            <>
              <div style={{ fontSize:18, fontWeight:900, color:T.ink, marginBottom:6 }}>Enter OTP</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:24 }}>
                Sent to WhatsApp <strong style={{ color:T.ink }}>+91 {phone}</strong>
                <button onClick={()=>{setStep("phone");setOtp("");setError("");}}
                  style={{ background:"none", border:"none", color:T.saffron,
                    fontWeight:700, fontSize:12, marginLeft:8, cursor:"pointer" }}>Change</button>
              </div>
              <OtpInput value={otp} onChange={setOtp}/>
              <div style={{ textAlign:"center", marginTop:10, padding:"9px 14px",
                background:T.saffronL, border:`1px solid ${T.saffron}25`,
                borderRadius:10, fontSize:12, color:T.ink2, lineHeight:1.6 }}>
                🔐 During beta, use the access code sent to you on WhatsApp by the RentAI team.
                <br/>
                <span style={{ fontSize:11, color:T.muted }}>
                  Haven't received it? Email <a href="mailto:support@rentai.co.in"
                  style={{ color:T.saffron, fontWeight:700, textDecoration:"none" }}>support@rentai.co.in</a>
                </span>
              </div>
              {error && <div style={{ color:T.rose, fontSize:12, marginTop:12,
                textAlign:"center", fontWeight:600 }}>{error}</div>}
              <button onClick={verifyOtp} disabled={loading || otp.length < 6}
                style={{ width:"100%", marginTop:20, padding:14,
                  background:otp.length===6?`linear-gradient(135deg,${T.saffron},${T.saffronB})`:T.panel,
                  border:"none", borderRadius:12, fontSize:15, fontWeight:800,
                  color:otp.length===6?"#fff":T.muted,
                  display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  transition:"all .2s" }}>
                {loading ? <Spinner/> : "Verify & Login →"}
              </button>
              <div style={{ textAlign:"center", marginTop:14, fontSize:12, color:T.muted }}>
                {resendTimer > 0
                  ? `Resend OTP in ${resendTimer}s`
                  : <button onClick={()=>{setOtp("");sendOtp();}}
                      style={{ background:"none", border:"none", color:T.saffron,
                        fontWeight:700, fontSize:12, cursor:"pointer" }}>
                      Resend OTP
                    </button>
                }
              </div>
            </>
          )}

          {/* STEP: ROLE */}
          {step === "role" && (
            <>
              <div style={{ fontSize:18, fontWeight:900, color:T.ink, marginBottom:6 }}>Welcome to RentAI! 🎉</div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:24 }}>Are you a property owner or a tenant?</div>
              <div style={{ display:"flex", gap:12, marginBottom:20 }}>
                {[["owner","🏢","Property Owner","Manage flats & collect rent"],
                  ["tenant","🏠","Tenant","View bills & pay rent"]].map(([v,icon,label,sub])=>(
                  <button key={v} onClick={()=>setRole(v)}
                    style={{ flex:1, padding:"16px 8px", borderRadius:14,
                      border:`2px solid ${role===v?T.saffron:T.border2}`,
                      background:role===v?T.saffronL:T.panel,
                      cursor:"pointer", fontFamily:"inherit", textAlign:"center", transition:"all .15s" }}>
                    <div style={{ fontSize:28, marginBottom:6 }}>{icon}</div>
                    <div style={{ fontSize:13, fontWeight:800, color:role===v?T.saffron:T.ink }}>{label}</div>
                    <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>{sub}</div>
                  </button>
                ))}
              </div>
              <button onClick={()=>setStep("profile")}
                style={{ width:"100%", padding:14, background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border:"none", borderRadius:12, fontSize:15, fontWeight:800, color:"#fff", cursor:"pointer" }}>
                Continue as {role==="owner"?"Owner":"Tenant"} →
              </button>
            </>
          )}

          {/* STEP: PROFILE (first time) */}
          {step === "profile" && (
            <>
              <div style={{ fontSize:18, fontWeight:900, color:T.ink, marginBottom:6 }}>
                {role==="owner"?"Set up your account":"Almost there!"} 🎉
              </div>
              <div style={{ fontSize:13, color:T.muted, marginBottom:24 }}>Quick setup — takes 30 seconds</div>
              {[
                { label:"Your Name", key:"name", value:name, set:setName, placeholder:"e.g. Suresh Rao" },
                ...(role==="owner"?[{ label:"City", key:"city", value:city, set:setCity, placeholder:"e.g. Bengaluru" }]:[]),
              ].map(f => (
                <div key={f.key} style={{ marginBottom:14 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:6 }}>{f.label}</div>
                  <input value={f.value} onChange={e=>f.set(e.target.value)} placeholder={f.placeholder}
                    style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                      color:T.ink, borderRadius:10, padding:"11px 14px", fontSize:14, fontWeight:600 }}/>
                </div>
              ))}
              {error && <div style={{ color:T.rose, fontSize:12, marginBottom:8, fontWeight:600 }}>{error}</div>}
              <button onClick={createProfile} disabled={loading}
                style={{ width:"100%", marginTop:8, padding:14,
                  background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border:"none", borderRadius:12, fontSize:15, fontWeight:800,
                  color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", gap:8 }}>
                {loading ? <Spinner/> : "Enter RentAI →"}
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign:"center", marginTop:16, fontSize:11, color:T.muted }}>
          By logging in you agree to our{" "}
          <span style={{ color:T.saffron, fontWeight:700, cursor:"pointer" }}>Terms</span>
          {" "}and{" "}
          <span style={{ color:T.saffron, fontWeight:700, cursor:"pointer" }}>Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ADD TENANT FORM
// ══════════════════════════════════════════════════════════════
function AddTenantForm({ unitId, ownerId, onSaved, onCancel }) {
  const [form, setForm] = useState({
    name:"", phone:"", email:"", move_in_date:"", lease_end:"", notes:""
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    if(!form.name.trim()) { setError("Tenant name is required"); return; }
    setSaving(true); setError("");
    try {
      // Insert tenant
      const { data: tenant, error: tErr } = await supabase
        .from("tenants")
        .insert({
          owner_id: ownerId,
          unit_id: unitId,
          name: form.name.trim(),
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          move_in_date: form.move_in_date || null,
          lease_end: form.lease_end || null,
          notes: form.notes.trim() || null,
          is_active: true,
        })
        .select("*").single();

      if(tErr) throw tErr;

      // Mark unit as occupied
      await supabase.from("units").update({ is_occupied:true }).eq("id", unitId);

      // Auto-create first month rent payment
      const today = new Date();
      const dueDate = form.move_in_date || today.toISOString().split("T")[0];
      const { data: unitData } = await supabase
        .from("units").select("rent_amount").eq("id", unitId).single();

      if(unitData) {
        await supabase.from("payments").insert({
          owner_id: ownerId,
          unit_id: unitId,
          tenant_id: tenant.id,
          type: "rent",
          amount: unitData.rent_amount,
          due_date: dueDate,
          status: "pending",
        });
      }

      onSaved();
    } catch(e) {
      setError("Failed to add tenant. Please try again.");
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:14 }}>
        + Add Tenant
      </div>
      {[
        { label:"Full Name *", key:"name", placeholder:"e.g. Ramesh Kumar", type:"text" },
        { label:"WhatsApp Number", key:"phone", placeholder:"e.g. 9876543210", type:"tel" },
        { label:"Email", key:"email", placeholder:"e.g. ramesh@gmail.com", type:"email" },
        { label:"Move-in Date", key:"move_in_date", placeholder:"", type:"date" },
        { label:"Lease End Date", key:"lease_end", placeholder:"", type:"date" },
      ].map(f => (
        <div key={f.key} style={{ marginBottom:11 }}>
          <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
            textTransform:"uppercase", marginBottom:5 }}>{f.label}</div>
          <input type={f.type} value={form[f.key]}
            onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}
            placeholder={f.placeholder}
            style={{ width:"100%", background:T.surface, border:`1.5px solid ${T.border2}`,
              color:T.ink, borderRadius:10, padding:"9px 12px", fontSize:13,
              fontWeight:600, boxSizing:"border-box" }}/>
        </div>
      ))}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
          textTransform:"uppercase", marginBottom:5 }}>Notes (optional)</div>
        <textarea value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
          placeholder="Any notes about this tenant..."
          rows={2}
          style={{ width:"100%", background:T.surface, border:`1.5px solid ${T.border2}`,
            color:T.ink, borderRadius:10, padding:"9px 12px", fontSize:13,
            fontWeight:600, boxSizing:"border-box", resize:"none", fontFamily:"inherit" }}/>
      </div>
      {error && <div style={{ color:T.rose, fontSize:12, marginBottom:10, fontWeight:600 }}>{error}</div>}
      <div style={{ background:T.tealL, border:`1px solid ${T.teal}25`, borderRadius:10,
        padding:"9px 12px", fontSize:12, color:T.teal, marginBottom:14, fontWeight:600 }}>
        ✓ Unit will be marked occupied · First rent payment created automatically
      </div>
      <div style={{ display:"flex", gap:8 }}>
        <button onClick={onCancel}
          style={{ flex:1, padding:"9px", background:T.panel, border:`1.5px solid ${T.border2}`,
            borderRadius:10, fontSize:13, fontWeight:700, color:T.muted, cursor:"pointer" }}>
          Cancel
        </button>
        <button onClick={save} disabled={saving}
          style={{ flex:2, padding:"9px", background:T.saffron, border:"none",
            borderRadius:10, fontSize:13, fontWeight:800, color:"#fff", cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
          {saving ? <Spinner/> : "Save Tenant →"}
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// OWNER DASHBOARD
// ══════════════════════════════════════════════════════════════
function OwnerDashboard({ owner, onLogout }) {
  const [tab, setTab] = useState("dashboard");
  const [units, setUnits] = useState([]);
  const [payments, setPayments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [newUnit, setNewUnit] = useState({ unit_number:"", rent_amount:"", deposit:"", type:"flat" });
  const [saving, setSaving] = useState(false);
  const [selUnit, setSelUnit] = useState(null);
  const [editTenant, setEditTenant] = useState(null);
  const [expandedTile, setExpandedTile] = useState(null);
  const [expenses, setExpenses] = useState([]);
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [newExp, setNewExp] = useState({ title:"", amount:"", category:"repair", unit_id:"", date:"", notes:"" });
  const [savingExp, setSavingExp] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3000); };

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: u }, { data: p }, { data: r }, { data: e }] = await Promise.all([
        supabase.from("units").select("*, tenants(*)").eq("owner_id", owner.id).order("unit_number"),
        supabase.from("payments").select("*, units(unit_number), tenants(name, phone)").eq("owner_id", owner.id).order("created_at", { ascending:false }).limit(50),
        supabase.from("maintenance_requests").select("*, units(unit_number)").eq("owner_id", owner.id).order("created_at", { ascending:false }),
        supabase.from("expenses").select("*, units(unit_number)").eq("owner_id", owner.id).order("date", { ascending:false }).limit(100),
      ]);
      setUnits(u || []);
      setPayments(p || []);
      setRequests(r || []);
      setExpenses(e || []);
    } catch(e) { console.error(e); }
    setLoading(false);
  }, [owner.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Auto-generate monthly rent payments for all occupied units
  const autoGeneratePayments = useCallback(async () => {
    try {
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const monthLabel = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;

      // Get all occupied units with active tenants
      const { data: occupiedUnits } = await supabase
        .from("units")
        .select("*, tenants(*)")
        .eq("owner_id", owner.id)
        .eq("is_occupied", true);

      if(!occupiedUnits || occupiedUnits.length === 0) return;

      for(const unit of occupiedUnits) {
        const tenant = unit.tenants?.find(t => t.is_active);
        if(!tenant) continue;

        // Check if rent payment already exists for this month
        const { data: existing } = await supabase
          .from("payments")
          .select("id")
          .eq("unit_id", unit.id)
          .eq("type", "rent")
          .gte("due_date", monthStart.toISOString().split("T")[0])
          .lte("due_date", monthEnd.toISOString().split("T")[0])
          .limit(1);

        if(existing && existing.length > 0) continue; // Already exists

        // Create this month's rent payment
        const dueDate = new Date(now.getFullYear(), now.getMonth(),
          Math.min(1, monthEnd.getDate())).toISOString().split("T")[0];

        await supabase.from("payments").insert({
          owner_id: owner.id,
          unit_id: unit.id,
          tenant_id: tenant.id,
          type: "rent",
          amount: unit.rent_amount,
          due_date: dueDate,
          status: "pending",
          notes: `Auto-generated · ${monthLabel}`,
        });
      }

      // Reload payments after generation
      const { data: p } = await supabase
        .from("payments")
        .select("*, units(unit_number), tenants(name)")
        .eq("owner_id", owner.id)
        .order("created_at", { ascending:false })
        .limit(50);
      if(p) setPayments(p);

    } catch(e) { console.error("Auto-generate payments error:", e); }
  }, [owner.id]);

  useEffect(() => {
    if(units.length > 0) autoGeneratePayments();
  }, [units, autoGeneratePayments]);

  const addUnit = async () => {
    if(!newUnit.unit_number || !newUnit.rent_amount) { showToast("Unit number and rent are required"); return; }
    if(newUnit.status === "occupied" && !newUnit.tenant_name?.trim()) { showToast("Please enter tenant name"); return; }
    setSaving(true);
    try {
      const isOccupied = newUnit.status === "occupied";

      // Get or create default property
      let { data: props } = await supabase.from("properties").select("id").eq("owner_id", owner.id).limit(1);
      let propId;
      if(!props || props.length === 0) {
        const { data: newProp } = await supabase.from("properties")
          .insert({ owner_id:owner.id, name:`${owner.name||"My"}'s Property`, city:owner.city||"Bengaluru" })
          .select("id").single();
        propId = newProp.id;
      } else { propId = props[0].id; }

      // Create unit
      const { data: unitData } = await supabase.from("units").insert({
        owner_id: owner.id, property_id: propId,
        unit_number: newUnit.unit_number,
        rent_amount: parseFloat(newUnit.rent_amount),
        deposit: newUnit.deposit ? parseFloat(newUnit.deposit) : null,
        type: newUnit.type,
        is_occupied: isOccupied,
      }).select("*").single();

      // If occupied, create tenant and first payment
      if(isOccupied && unitData) {
        const phone = newUnit.tenant_phone?.replace(/\D/g,"");
        const { data: tenantData } = await supabase.from("tenants").insert({
          owner_id: owner.id,
          unit_id: unitData.id,
          name: newUnit.tenant_name.trim(),
          phone: phone ? `+91${phone}` : null,
          email: newUnit.tenant_email?.trim() || null,
          move_in_date: newUnit.tenant_move_in || null,
          lease_end: newUnit.tenant_lease_end || null,
          is_active: true,
        }).select("*").single();

        if(tenantData) {
          await supabase.from("payments").insert({
            owner_id: owner.id,
            unit_id: unitData.id,
            tenant_id: tenantData.id,
            type: "rent",
            amount: parseFloat(newUnit.rent_amount),
            due_date: newUnit.tenant_move_in || new Date().toISOString().split("T")[0],
            status: "pending",
          });
        }
        showToast("Unit + tenant added ✓");
      } else {
        showToast("Unit added ✓");
      }

      setNewUnit({ unit_number:"", rent_amount:"", deposit:"", type:"flat", status:"vacant",
        tenant_name:"", tenant_phone:"", tenant_email:"", tenant_move_in:"", tenant_lease_end:"" });
      setShowAddUnit(false);
      loadData();
    } catch(e) { showToast("Error adding unit"); console.error(e); }
    setSaving(false);
  };

  const markPaid = async (paymentId) => {
    // Find the payment to check if it's a verification
    const payment = payments.find(p => p.id === paymentId);
    const isVerification = payment?.status === "verification_pending";

    await supabase.from("payments").update({
      status: "paid",
      paid_date: new Date().toISOString().split("T")[0],
    }).eq("id", paymentId);

    showToast(isVerification ? "Payment verified ✓" : "Marked as paid ✓");

    // If verifying, optionally open WhatsApp to notify tenant
    if(isVerification && payment?.tenants?.phone) {
      const phone = payment.tenants.phone.replace(/\D/g,"");
      const num = phone.startsWith("91") ? phone : "91" + phone;
      const name = (payment.tenants.name||"").split(" ")[0];
      const msg = `Hi ${name}, your ${payment.type} payment of ${fd(payment.amount)} has been verified and confirmed. Thank you! - ${owner.name||"Your Landlord"} via RentAI`;
      setTimeout(() => window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, "_blank"), 400);
    }

    loadData();
  };

  const vacateTenant = async (unitId, tenantId) => {
    await Promise.all([
      supabase.from("units").update({ is_occupied:false }).eq("id", unitId),
      supabase.from("tenants").update({ is_active:false, unit_id:null }).eq("id", tenantId),
    ]);
    setSelUnit(null);
    showToast("Unit marked as vacant ✓");
    loadData();
  };

  const resolveRequest = async (id) => {
    await supabase.from("maintenance_requests").update({ status:"resolved", resolved_at:new Date().toISOString() }).eq("id", id);
    showToast("Marked as resolved ✓");
    loadData();
  };

  const occupied = units.filter(u => u.is_occupied);
  const totalExpected = occupied.reduce((s,u) => s + Number(u.rent_amount), 0);
  const pendingPayments = payments.filter(p => p.status === "pending" || p.status === "verification_pending");
  const totalPending = pendingPayments.filter(p=>p.status==="pending").reduce((s,p) => s + Number(p.amount), 0);
  const verifyCount = payments.filter(p => p.status === "verification_pending").length;
  const openReqs = requests.filter(r => r.status === "open").length;
  const firstName = (owner.name||"").split(" ")[0] || "there";

  // ── LEASE TRACKING ───────────────────────────────────────────
  const today = new Date();
  today.setHours(0,0,0,0);

  const leaseAlerts = units.filter(u => {
    const tenant = u.tenants?.[0];
    if(!tenant?.lease_end) return false;
    const leaseEnd = new Date(tenant.lease_end);
    const daysLeft = Math.ceil((leaseEnd - today) / (1000*60*60*24));
    return daysLeft <= 60 && daysLeft >= 0;
  }).map(u => {
    const tenant = u.tenants[0];
    const leaseEnd = new Date(tenant.lease_end);
    const daysLeft = Math.ceil((leaseEnd - today) / (1000*60*60*24));
    return { unit: u, tenant, daysLeft,
      color: daysLeft <= 15 ? T.rose : daysLeft <= 30 ? T.amber : T.sky,
      label: daysLeft === 0 ? "Expires today!" : daysLeft < 0 ? "Expired" : `${daysLeft} days left`
    };
  }).sort((a,b) => a.daysLeft - b.daysLeft);

  // ── P&L FORECAST (6 months) ──────────────────────────────────
  const pnlForecast = Array.from({length:6}, (_,i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const monthLabel = d.toLocaleString("en-IN", { month:"short", year:"2-digit" });

    // Count units that will still be occupied (lease not expired)
    const activeUnits = occupied.filter(u => {
      const tenant = u.tenants?.[0];
      if(!tenant?.lease_end) return true; // no end date = assume active
      return new Date(tenant.lease_end) >= d;
    });

    const expected = activeUnits.reduce((s,u) => s + Number(u.rent_amount), 0);

    // Historical collected for past months
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0];
    const monthEnd = new Date(d.getFullYear(), d.getMonth()+1, 0).toISOString().split("T")[0];
    const collected = payments.filter(p =>
      p.status === "paid" && p.paid_date >= monthStart && p.paid_date <= monthEnd
    ).reduce((s,p) => s + Number(p.amount), 0);

    const isFuture = d > today;
    return { label:monthLabel, expected, collected: isFuture ? null : collected, isFuture };
  });

  const saveExpense = async () => {
    if(!newExp.title.trim()) { showToast("Please enter a description"); return; }
    if(!newExp.amount || isNaN(newExp.amount) || parseFloat(newExp.amount) <= 0) {
      showToast("Please enter a valid amount greater than 0"); return;
    }
    setSavingExp(true);
    try {
      const { error: insertErr } = await supabase.from("expenses").insert({
        owner_id: owner.id,
        unit_id:  newExp.unit_id || null,
        title:    newExp.title.trim(),
        amount:   parseFloat(newExp.amount),
        category: newExp.category,
        date:     newExp.date || new Date().toISOString().split("T")[0],
        notes:    newExp.notes.trim() || null,
      });
      if(insertErr) throw insertErr;
      setNewExp({ title:"", amount:"", category:"repair", unit_id:"", date:"", notes:"" });
      setShowAddExpense(false);
      showToast("Expense saved ✓");
      loadData();
    } catch(e) {
      const msg = e?.message || "";
      if(msg.includes("relation") || msg.includes("does not exist")) {
        showToast("⚠️ Run the expenses SQL migration in Supabase first");
      } else if(msg.includes("violates")) {
        showToast("⚠️ Check column values — " + msg.slice(0,60));
      } else {
        showToast("Failed to save: " + (msg.slice(0,60) || "unknown error"));
      }
      console.error("saveExpense error:", e);
    }
    setSavingExp(false);
  };

  const deleteExpense = async (id) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if(error) { showToast("Could not delete expense"); return; }
    showToast("Expense deleted");
    loadData();
  };

  const totalExpenses  = expenses.reduce((s, e) => s + (isNaN(Number(e.amount)) ? 0 : Number(e.amount)), 0);
  const totalCollected = payments.filter(p => p.status === "paid").reduce((s,p) => s + (isNaN(Number(p.amount)) ? 0 : Number(p.amount)), 0);
  const netIncome      = totalCollected - totalExpenses;

  const EXP_CATEGORIES = [
    { value:"repair",      label:"🔧 Repair",        color: T.rose },
    { value:"maintenance", label:"🛠 Maintenance",    color: T.amber },
    { value:"cleaning",    label:"🧹 Cleaning",       color: T.sky },
    { value:"utility",     label:"💡 Utility",        color: T.plum },
    { value:"tax",         label:"📋 Tax / Legal",    color: T.ink2 },
    { value:"insurance",   label:"🛡 Insurance",      color: T.teal },
    { value:"renovation",  label:"🏗 Renovation",     color: T.saffron },
    { value:"other",       label:"📦 Other",          color: T.muted },
  ];
  const catMeta = (val) => EXP_CATEGORIES.find(c => c.value === val) || EXP_CATEGORIES[EXP_CATEGORIES.length-1];

  const tabs = [
    { id:"dashboard", icon:"📊", label:"Dashboard" },
    { id:"units",     icon:"🏡", label:"Units" },
    { id:"payments",  icon:"💰", label:"Payments" },
    { id:"expenses",  icon:"🧾", label:"Expenses" },
    { id:"requests",  icon:"🔧", label:"Requests" },
  ];

  if(loading) return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
      <style>{CSS}</style>
      <Spinner/>
      <div style={{ fontSize:13, color:T.muted, fontWeight:600 }}>Loading your dashboard…</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      color:T.ink, minHeight:"100vh", display:"flex", flexDirection:"column",
      maxWidth:520, margin:"0 auto" }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ background:T.surface, borderBottom:`1.5px solid ${T.border}`,
        padding:"11px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:9,
            background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🔑</div>
          <div>
            <div style={{ fontWeight:900, fontSize:14, color:T.ink, letterSpacing:-.3 }}>RentAI</div>
            <div style={{ fontSize:9, color:T.muted }}>{owner.name || owner.phone} · Owner</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background:T.panel, border:`1.5px solid ${T.border}`,
            borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700,
            color:T.muted, cursor:"pointer" }}>Logout</button>
      </div>

      {/* Content */}
      <div style={{ flex:1, overflowY:"auto", paddingBottom:72 }}>

        {/* DASHBOARD TAB */}
        {tab === "dashboard" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:15, fontWeight:800, color:T.ink }}>
                Good morning, {firstName}! 👋
              </div>
              <button onClick={async()=>{ await autoGeneratePayments(); showToast("Payments refreshed ✓"); }}
                style={{ background:T.tealL, border:`1px solid ${T.teal}30`, borderRadius:9,
                  padding:"6px 12px", fontSize:11, fontWeight:700, color:T.teal, cursor:"pointer" }}>
                🔄 Refresh
              </button>
            </div>

            {/* P&L Banner */}
            <div style={{ background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
              borderRadius:18, padding:20, marginBottom:18, color:"#fff",
              position:"relative", overflow:"hidden" }}>
              <div style={{ position:"absolute", top:-20, right:-20, width:90, height:90,
                borderRadius:"50%", background:"rgba(255,255,255,.1)", pointerEvents:"none" }}/>
              <div style={{ fontSize:10, fontWeight:700, opacity:.8, letterSpacing:.5, marginBottom:3 }}>
                RENT PENDING THIS MONTH
              </div>
              <div style={{ fontSize:32, fontWeight:900, letterSpacing:-1.5 }}>{fd(totalPending)}</div>
              <div style={{ display:"flex", gap:16, marginTop:10, flexWrap:"wrap" }}>
                {[["Expected", fd(totalExpected)], ["Units", `${occupied.length}/${units.length}`], ["Pending", pendingPayments.length+" bills"]].map(([l,v])=>(
                  <div key={l}><div style={{ fontSize:9, opacity:.75 }}>{l}</div><div style={{ fontSize:14, fontWeight:800 }}>{v}</div></div>
                ))}
              </div>
            </div>

            {/* Stats grid — expandable tiles */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11, marginBottom:18 }}>
              {[
                { id:"occupied", icon:"🏡", label:"Occupied", value:`${occupied.length}/${units.length}`, sub:`${units.length-occupied.length} vacant`, color:T.teal, light:T.tealL },
                { id:"pending", icon:"⚠️", label:"Rent Pending", value:pendingPayments.length, sub:fd(totalPending)+" due", color:T.rose, light:T.roseL },
                { id:"requests", icon:"🔧", label:"Open Requests", value:openReqs, sub:"maintenance", color:T.sky, light:T.skyL },
                { id:"units", icon:"📋", label:"Total Units", value:units.length, sub:"in portfolio", color:T.amber, light:T.amberL },
              ].map(s => (
                <div key={s.id} onClick={()=>setExpandedTile(expandedTile===s.id?null:s.id)}
                  style={{ background:T.card,
                    border:`1.5px solid ${expandedTile===s.id?s.color:T.border}`,
                    borderRadius:14, padding:14, cursor:"pointer",
                    transition:"all .15s", gridColumn: expandedTile===s.id ? "1 / -1" : "auto" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                    <div>
                      <div style={{ width:32, height:32, borderRadius:9, background:s.light,
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:15, marginBottom:7 }}>{s.icon}</div>
                      <div style={{ fontSize:22, fontWeight:900, color:T.ink, letterSpacing:-.8 }}>{s.value}</div>
                      <div style={{ fontSize:11, fontWeight:700, color:T.ink2, marginTop:1 }}>{s.label}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>{s.sub}</div>
                    </div>
                    <div style={{ fontSize:12, color:T.muted }}>{expandedTile===s.id?"▲":"▼"}</div>
                  </div>

                  {/* Expanded content */}
                  {expandedTile === s.id && (
                    <div style={{ marginTop:12, borderTop:`1px solid ${s.color}25`, paddingTop:12 }}
                      onClick={e=>e.stopPropagation()}>

                      {/* OCCUPIED tile */}
                      {s.id === "occupied" && (
                        occupied.length === 0
                          ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>No occupied units</div>
                          : occupied.map(u => {
                              const t = u.tenants?.[0];
                              return (
                                <div key={u.id} style={{ display:"flex", alignItems:"center", gap:9,
                                  marginBottom:8, padding:"8px 10px", background:T.tealL,
                                  borderRadius:10, border:`1px solid ${T.teal}20` }}>
                                  <div style={{ width:28, height:28, borderRadius:8, background:T.teal,
                                    display:"flex", alignItems:"center", justifyContent:"center",
                                    fontSize:10, fontWeight:800, color:"#fff", flexShrink:0 }}>
                                    {(t?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)}
                                  </div>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{t?.name||"No tenant"}</div>
                                    <div style={{ fontSize:10, color:T.muted }}>{u.unit_number} · {fd(u.rent_amount)}/mo</div>
                                  </div>
                                  {t?.lease_end && (()=>{
                                    const d = Math.ceil((new Date(t.lease_end)-today)/(1000*60*60*24));
                                    const c = d<=15?T.rose:d<=30?T.amber:T.teal;
                                    return <div style={{ fontSize:9,fontWeight:800,color:c,background:`${c}15`,padding:"2px 7px",borderRadius:20 }}>{d}d</div>;
                                  })()}
                                </div>
                              );
                            })
                      )}

                      {/* PENDING tile */}
                      {s.id === "pending" && (
                        pendingPayments.length === 0
                          ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>No pending payments 🎉</div>
                          : <>
                              {pendingPayments.slice(0,6).map(p => (
                                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:9,
                                  marginBottom:8, padding:"8px 10px", background:T.roseL,
                                  borderRadius:10, border:`1px solid ${T.rose}20` }}>
                                  <div style={{ flex:1 }}>
                                    <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{p.tenants?.name||"Tenant"}</div>
                                    <div style={{ fontSize:10, color:T.muted }}>{p.units?.unit_number} · {p.type} · Due {fmt(p.due_date)}</div>
                                  </div>
                                  <div style={{ fontSize:13, fontWeight:900, color:T.rose }}>{fd(p.amount)}</div>
                                  <button onClick={()=>markPaid(p.id)}
                                    style={{ background:T.teal, border:"none", borderRadius:7,
                                      padding:"4px 9px", fontSize:10, fontWeight:700,
                                      color:"#fff", cursor:"pointer", flexShrink:0 }}>✓</button>
                                </div>
                              ))}
                              <button onClick={()=>{
                                const msgs = pendingPayments.map(p=>{
                                  const ph = p.tenants?.phone?.replace(/\D/g,"");
                                  if(!ph) return null;
                                  return `https://wa.me/${ph.startsWith("91")?ph:"91"+ph}?text=Hi ${(p.tenants?.name||"").split(" ")[0]}, your ${p.type} of ${fd(p.amount)} is due. - ${owner.name||"Landlord"} via RentAI`;
                                }).filter(Boolean);
                                if(!msgs.length){showToast("No phone numbers saved");return;}
                                msgs.forEach((url,i)=>setTimeout(()=>window.open(url,"_blank"),i*500));
                                showToast(`WhatsApp opened for ${msgs.length} tenants`);
                              }} style={{ width:"100%", padding:"8px", background:"#25D366",
                                border:"none", borderRadius:9, fontSize:12, fontWeight:800,
                                color:"#fff", cursor:"pointer", marginTop:4 }}>
                                📱 Remind All ({pendingPayments.length})
                              </button>
                            </>
                      )}

                      {/* REQUESTS tile */}
                      {s.id === "requests" && (
                        requests.filter(r=>r.status==="open").length === 0
                          ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>No open requests 🎉</div>
                          : requests.filter(r=>r.status==="open").map(r => (
                              <div key={r.id} style={{ display:"flex", alignItems:"center", gap:9,
                                marginBottom:8, padding:"8px 10px", background:T.skyL,
                                borderRadius:10, border:`1px solid ${T.sky}20` }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{r.title}</div>
                                  <div style={{ fontSize:10, color:T.muted }}>{r.units?.unit_number} · {fmt(r.created_at)}</div>
                                </div>
                                <Chip label={r.priority} color={r.priority==="high"?T.rose:r.priority==="medium"?T.amber:T.teal}/>
                                <button onClick={()=>resolveRequest(r.id)}
                                  style={{ background:T.teal, border:"none", borderRadius:7,
                                    padding:"4px 9px", fontSize:10, fontWeight:700,
                                    color:"#fff", cursor:"pointer", flexShrink:0 }}>✓</button>
                              </div>
                            ))
                      )}

                      {/* TOTAL UNITS tile */}
                      {s.id === "units" && (
                        units.length === 0
                          ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"8px 0" }}>No units yet</div>
                          : units.map(u => (
                              <div key={u.id} style={{ display:"flex", alignItems:"center", gap:9,
                                marginBottom:8, padding:"8px 10px",
                                background:u.is_occupied?T.tealL:T.panel,
                                borderRadius:10, border:`1px solid ${u.is_occupied?T.teal+"20":T.border}` }}>
                                <div style={{ flex:1 }}>
                                  <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{u.unit_number}</div>
                                  <div style={{ fontSize:10, color:T.muted }}>{fd(u.rent_amount)}/mo · {u.type}</div>
                                </div>
                                <Chip label={u.is_occupied?"Occupied":"Vacant"} color={u.is_occupied?T.teal:T.rose}/>
                              </div>
                            ))
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pending payments list */}
            {pendingPayments.length > 0 && (
              <>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                  <div style={{ fontWeight:800, fontSize:13, color:T.ink }}>
                    Pending Payments ({pendingPayments.length})
                  </div>
                  <button onClick={()=>{
                    const msgs = pendingPayments.slice(0,5).map(p => {
                      const phone = p.tenants?.phone?.replace(/\D/g,"");
                      if(!phone) return null;
                      return `https://wa.me/${phone.startsWith("91")?phone:"91"+phone}?text=Hi ${(p.tenants?.name||"").split(" ")[0]}, your ${p.type} of ${fd(p.amount)} is due. Please pay at your earliest. - ${owner.name||"Your Landlord"} via RentAI`;
                    }).filter(Boolean);
                    if(msgs.length === 0) { showToast("No phone numbers saved for pending tenants"); return; }
                    msgs.forEach((url, i) => setTimeout(()=>window.open(url,"_blank"), i*500));
                    showToast(`Opening WhatsApp for ${msgs.length} tenants…`);
                  }}
                    style={{ background:"#25D366", border:"none", borderRadius:8,
                      padding:"6px 12px", fontSize:11, fontWeight:700,
                      color:"#fff", cursor:"pointer" }}>
                    📱 Remind All
                  </button>
                </div>
                {pendingPayments.slice(0,5).map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10,
                    marginBottom:9, padding:"10px 13px", background:T.card,
                    border:`1.5px solid ${p.status==="verification_pending"?T.amber+"50":T.border}`,
                    borderRadius:13 }}>
                    <div style={{ width:34, height:34, borderRadius:10,
                      background:p.status==="verification_pending"?T.amberL:T.roseL,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontWeight:800, fontSize:11,
                      color:p.status==="verification_pending"?T.amber:T.rose, flexShrink:0 }}>
                      {(p.tenants?.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{p.tenants?.name || "Tenant"}</div>
                        {p.status==="verification_pending" && <Chip label="Verify!" color={T.amber}/>}
                      </div>
                      <div style={{ fontSize:10, color:T.muted }}>
                        {p.units?.unit_number} · {p.type} · {fd(p.amount)}
                      </div>
                      {p.utr_number && (
                        <div style={{ fontSize:10, color:T.amber, fontWeight:700 }}>UTR: {p.utr_number}</div>
                      )}
                    </div>
                    <button onClick={()=>markPaid(p.id)}
                      style={{ background:p.status==="verification_pending"?T.amber:T.tealL,
                        border:`1px solid ${p.status==="verification_pending"?T.amber:T.teal}30`,
                        borderRadius:8, padding:"5px 10px", fontSize:11,
                        fontWeight:700, color:p.status==="verification_pending"?"#fff":T.teal,
                        cursor:"pointer", flexShrink:0 }}>
                      {p.status==="verification_pending"?"✅ Verify":"✓ Paid"}
                    </button>
                  </div>
                ))}
              </>
            )}

            {units.length === 0 && (
              <div style={{ textAlign:"center", padding:"32px 20px", background:T.card,
                border:`1.5px solid ${T.border}`, borderRadius:16, marginTop:8 }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🏠</div>
                <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:6 }}>Add your first unit</div>
                <div style={{ fontSize:13, color:T.muted, marginBottom:16 }}>
                  Start by adding a flat or room to track rent
                </div>
                <button onClick={()=>{setTab("units");setShowAddUnit(true);}}
                  style={{ background:T.saffron, border:"none", borderRadius:10,
                    padding:"10px 24px", fontSize:13, fontWeight:800, color:"#fff", cursor:"pointer" }}>
                  + Add Unit
                </button>
              </div>
            )}

            {/* LEASE ALERTS */}
            {leaseAlerts.length > 0 && (
              <div style={{ marginTop:18 }}>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:10 }}>
                  🗓 Lease Alerts
                </div>
                {leaseAlerts.map(({ unit:u, tenant, daysLeft, color, label }) => (
                  <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10,
                    marginBottom:9, padding:"11px 13px", background:T.card,
                    border:`1.5px solid ${color}35`, borderRadius:13 }}>
                    <div style={{ width:36, height:36, borderRadius:10,
                      background:`${color}15`, display:"flex", alignItems:"center",
                      justifyContent:"center", fontSize:16, flexShrink:0 }}>
                      {daysLeft <= 15 ? "🔴" : daysLeft <= 30 ? "🟡" : "🔵"}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>
                        {u.unit_number} · {tenant.name}
                      </div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:1 }}>
                        Lease ends {fmt(tenant.lease_end)}
                      </div>
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:11, fontWeight:800, color,
                        padding:"3px 9px", borderRadius:20,
                        background:`${color}15`, border:`1px solid ${color}30` }}>
                        {label}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* P&L FORECAST */}
            {units.length > 0 && (
              <div style={{ background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:16, padding:16, marginTop:18 }}>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:4 }}>
                  📈 6-Month Revenue Forecast
                </div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>
                  Based on current occupancy and lease end dates
                </div>

                {/* Bar chart */}
                <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:80, marginBottom:10 }}>
                  {pnlForecast.map((m, i) => {
                    const max = Math.max(...pnlForecast.map(x => x.expected)) || 1;
                    const barH = Math.max(4, (m.expected / max) * 100);
                    const collH = m.collected ? Math.max(2, (m.collected / max) * 100) : 0;
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                        alignItems:"center", gap:2, height:"100%", justifyContent:"flex-end" }}>
                        <div style={{ width:"100%", position:"relative", height:`${barH}%`,
                          minHeight:4, display:"flex", alignItems:"flex-end" }}>
                          {/* Expected bar */}
                          <div style={{ position:"absolute", bottom:0, left:0, right:0,
                            height:"100%", background:`${T.saffron}25`,
                            borderRadius:"4px 4px 0 0" }}/>
                          {/* Collected/forecast bar */}
                          <div style={{ position:"absolute", bottom:0, left:0, right:0,
                            height:m.isFuture?`${barH}%`:`${collH}%`,
                            background:m.isFuture
                              ? `repeating-linear-gradient(45deg,${T.saffron}40,${T.saffron}40 2px,transparent 2px,transparent 6px)`
                              : T.saffron,
                            borderRadius:"4px 4px 0 0", transition:"height .3s" }}/>
                        </div>
                        <div style={{ fontSize:8, color:m.isFuture?T.muted:T.ink2,
                          fontWeight:700, textAlign:"center" }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display:"flex", gap:14, marginBottom:14 }}>
                  {[
                    { color:T.saffron, label:"Collected" },
                    { color:`${T.saffron}40`, label:"Expected (forecast)" },
                  ].map(l => (
                    <div key={l.label} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:2, background:l.color }}/>
                      <span style={{ fontSize:10, color:T.muted }}>{l.label}</span>
                    </div>
                  ))}
                </div>

                {/* Monthly breakdown */}
                {pnlForecast.map((m, i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between",
                    alignItems:"center", padding:"7px 0",
                    borderBottom: i < 5 ? `1px solid ${T.border}` : "none" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:"50%",
                        background: m.isFuture ? T.muted : T.saffron }}/>
                      <span style={{ fontSize:12, fontWeight:700,
                        color: m.isFuture ? T.muted : T.ink }}>{m.label}</span>
                      {m.isFuture && <span style={{ fontSize:9, color:T.muted,
                        background:T.panel, padding:"1px 6px", borderRadius:10 }}>forecast</span>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:12, fontWeight:800,
                        color: m.isFuture ? T.muted : T.ink }}>{fd(m.expected)}</div>
                      {!m.isFuture && m.collected > 0 && (
                        <div style={{ fontSize:10, color:T.teal }}>
                          {fd(m.collected)} collected
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Summary */}
                <div style={{ marginTop:14, padding:"10px 12px",
                  background:T.tealL, border:`1px solid ${T.teal}25`, borderRadius:10 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:T.teal }}>
                    6-month forecast total: {fd(pnlForecast.reduce((s,m)=>s+m.expected,0))}
                    {leaseAlerts.length > 0 && (
                      <span style={{ color:T.amber, marginLeft:8 }}>
                        ⚠ {leaseAlerts.length} lease{leaseAlerts.length>1?"s":""} expiring
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LEASE EXPIRY ALERTS */}
            {leaseAlerts.length > 0 && (
              <div style={{ marginTop:18 }}>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:10 }}>
                  ⏰ Lease Alerts ({leaseAlerts.length})
                </div>
                {leaseAlerts.map(({ unit:u, tenant, daysLeft, color, label }) => (
                  <div key={u.id} style={{ display:"flex", alignItems:"center", gap:10,
                    marginBottom:9, padding:"10px 13px", background:T.card,
                    border:`1.5px solid ${color}35`, borderRadius:13 }}>
                    <div style={{ width:34, height:34, borderRadius:10,
                      background:`${color}15`, display:"flex", alignItems:"center",
                      justifyContent:"center", fontWeight:800, fontSize:11, color, flexShrink:0 }}>
                      {(tenant.name||"?").split(" ").map(w=>w[0]).join("").slice(0,2)}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{tenant.name}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{u.unit_number} · Lease ends {fmt(tenant.lease_end)}</div>
                    </div>
                    <div style={{ padding:"3px 9px", borderRadius:20,
                      background:`${color}15`, border:`1px solid ${color}30`,
                      fontSize:10, fontWeight:800, color }}>{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* P&L FORECAST */}
            {units.length > 0 && (
              <div style={{ marginTop:18, background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:16, padding:16 }}>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:4 }}>
                  📈 Revenue Forecast
                </div>
                <div style={{ fontSize:11, color:T.muted, marginBottom:14 }}>
                  Based on current leases · 6-month outlook
                </div>

                {/* Bar chart */}
                <div style={{ display:"flex", alignItems:"flex-end", gap:4, height:80, marginBottom:10 }}>
                  {pnlForecast.map((m, i) => {
                    const maxVal = Math.max(...pnlForecast.map(x => x.expected), 1);
                    const expectedH = Math.round((m.expected / maxVal) * 80);
                    const collectedH = m.collected ? Math.round((m.collected / maxVal) * 80) : 0;
                    return (
                      <div key={i} style={{ flex:1, display:"flex", flexDirection:"column",
                        alignItems:"center", gap:2, height:"100%", justifyContent:"flex-end" }}>
                        <div style={{ width:"100%", position:"relative", height:expectedH }}>
                          {/* Expected bar (background) */}
                          <div style={{ position:"absolute", bottom:0, left:0, right:0,
                            height:"100%", background:`${T.saffron}20`,
                            borderRadius:"3px 3px 0 0" }}/>
                          {/* Collected bar (foreground) */}
                          {collectedH > 0 && (
                            <div style={{ position:"absolute", bottom:0, left:0, right:0,
                              height:`${Math.round((collectedH/expectedH)*100)}%`,
                              background:T.saffron, borderRadius:"3px 3px 0 0" }}/>
                          )}
                          {/* Future bar */}
                          {m.isFuture && (
                            <div style={{ position:"absolute", bottom:0, left:0, right:0,
                              height:"100%", background:`${T.saffron}40`,
                              borderRadius:"3px 3px 0 0",
                              backgroundImage:`repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(255,255,255,.3) 2px,rgba(255,255,255,.3) 4px)` }}/>
                          )}
                        </div>
                        <div style={{ fontSize:8, color:T.muted, fontWeight:700 }}>{m.label}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Legend */}
                <div style={{ display:"flex", gap:16, marginBottom:14 }}>
                  {[["Collected",T.saffron],["Expected",`${T.saffron}20`],["Forecast","repeating-linear-gradient(45deg,transparent,transparent 2px,rgba(0,0,0,.1) 2px,rgba(0,0,0,.1) 4px)"]].map(([l,c],i)=>(
                    <div key={l} style={{ display:"flex", alignItems:"center", gap:5 }}>
                      <div style={{ width:10, height:10, borderRadius:2,
                        background:i===2?`${T.saffron}40`:c, border:i===1?`1px solid ${T.saffron}40`:"none" }}/>
                      <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}>{l}</span>
                    </div>
                  ))}
                </div>

                {/* Summary row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8 }}>
                  {[
                    { label:"This Month", val:fd(pnlForecast[0]?.expected||0), sub:"expected", color:T.saffron },
                    { label:"Next 3 Months", val:fd(pnlForecast.slice(1,4).reduce((s,m)=>s+m.expected,0)), sub:"forecast", color:T.teal },
                    { label:"Annual Run Rate", val:"₹"+((totalExpected*12)/100000).toFixed(1)+"L", sub:"at full occupancy", color:T.plum },
                  ].map(s => (
                    <div key={s.label} style={{ background:T.panel, borderRadius:10, padding:"10px 8px", textAlign:"center" }}>
                      <div style={{ fontSize:13, fontWeight:900, color:s.color, letterSpacing:-.5 }}>{s.val}</div>
                      <div style={{ fontSize:9, color:T.muted, fontWeight:600, marginTop:2 }}>{s.label}</div>
                      <div style={{ fontSize:8, color:T.subtle, marginTop:1 }}>{s.sub}</div>
                    </div>
                  ))}
                </div>

                {/* Vacancy risk warning */}
                {leaseAlerts.length > 0 && (
                  <div style={{ marginTop:12, background:T.amberL, border:`1px solid ${T.amber}30`,
                    borderRadius:10, padding:"9px 12px", fontSize:12, color:T.amber, fontWeight:600 }}>
                    ⚠️ {leaseAlerts.length} lease{leaseAlerts.length>1?"s":""} expiring soon —
                    forecast may change if not renewed
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* UNITS TAB */}
        {tab === "units" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:T.ink }}>Your Units</div>
              <button onClick={()=>setShowAddUnit(true)}
                style={{ background:T.saffron, border:"none", borderRadius:10,
                  padding:"7px 14px", fontSize:12, fontWeight:800, color:"#fff", cursor:"pointer" }}>
                + Add Unit
              </button>
            </div>

            {/* Add unit form */}
            {showAddUnit && (
              <div style={{ background:T.surface, border:`1.5px solid ${T.saffron}40`,
                borderRadius:16, padding:18, marginBottom:18 }}>
                <div style={{ fontWeight:800, fontSize:14, color:T.ink, marginBottom:14 }}>New Unit</div>

                {/* Occupied / Vacant toggle */}
                <div style={{ display:"flex", gap:8, marginBottom:16 }}>
                  {[["vacant","🔓 Vacant"],["occupied","👤 Occupied"]].map(([v,l])=>(
                    <button key={v} onClick={()=>setNewUnit(p=>({...p,status:v}))}
                      style={{ flex:1, padding:"10px 8px", borderRadius:10,
                        border:`2px solid ${(newUnit.status||"vacant")===v?T.saffron:T.border2}`,
                        background:(newUnit.status||"vacant")===v?T.saffronL:T.panel,
                        color:(newUnit.status||"vacant")===v?T.saffron:T.muted,
                        fontSize:13, fontWeight:800, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                  ))}
                </div>

                {/* Unit details */}
                {[
                  { label:"Unit Number *", key:"unit_number", placeholder:"e.g. Flat 1A, Room 3" },
                  { label:"Monthly Rent (₹) *", key:"rent_amount", placeholder:"e.g. 10000", type:"number" },
                  { label:"Security Deposit (₹)", key:"deposit", placeholder:"e.g. 30000", type:"number" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:12 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                      textTransform:"uppercase", marginBottom:5 }}>{f.label}</div>
                    <input type={f.type||"text"} value={newUnit[f.key]}
                      onChange={e=>setNewUnit(p=>({...p,[f.key]:e.target.value}))}
                      placeholder={f.placeholder}
                      style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                        color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13, fontWeight:600 }}/>
                  </div>
                ))}

                {/* Unit type */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:6 }}>Type</div>
                  <div style={{ display:"flex", gap:8 }}>
                    {[["flat","🏠 Flat"],["room","🛏 Room"],["studio","🏙 Studio"],["shop","🏪 Shop"]].map(([v,l])=>(
                      <button key={v} onClick={()=>setNewUnit(p=>({...p,type:v}))}
                        style={{ flex:1, padding:"7px 4px", borderRadius:9,
                          border:`1.5px solid ${newUnit.type===v?T.saffron:T.border2}`,
                          background:newUnit.type===v?T.saffronL:T.panel,
                          color:newUnit.type===v?T.saffron:T.muted,
                          fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                    ))}
                  </div>
                </div>

                {/* Tenant details — only shown if Occupied */}
                {(newUnit.status||"vacant") === "occupied" && (
                  <div style={{ background:T.tealL, border:`1px solid ${T.teal}25`,
                    borderRadius:12, padding:14, marginBottom:14 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:T.teal, marginBottom:12 }}>
                      👤 Tenant Details
                    </div>
                    {[
                      { label:"Tenant Name *", key:"tenant_name", placeholder:"e.g. Ramesh Kumar" },
                      { label:"WhatsApp Number", key:"tenant_phone", placeholder:"e.g. 9876543210" },
                      { label:"Email", key:"tenant_email", placeholder:"e.g. ramesh@gmail.com" },
                      { label:"Move-in Date", key:"tenant_move_in", type:"date" },
                      { label:"Lease End Date", key:"tenant_lease_end", type:"date" },
                    ].map(f => (
                      <div key={f.key} style={{ marginBottom:10 }}>
                        <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                          textTransform:"uppercase", marginBottom:5 }}>{f.label}</div>
                        <input type={f.type||"text"} value={newUnit[f.key]||""}
                          onChange={e=>setNewUnit(p=>({...p,[f.key]:e.target.value}))}
                          placeholder={f.placeholder||""}
                          style={{ width:"100%", background:T.surface, border:`1.5px solid ${T.border2}`,
                            color:T.ink, borderRadius:10, padding:"9px 12px", fontSize:13, fontWeight:600,
                            boxSizing:"border-box" }}/>
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display:"flex", gap:8 }}>
                  <button onClick={()=>{setShowAddUnit(false);setNewUnit({unit_number:"",rent_amount:"",deposit:"",type:"flat",status:"vacant"});}}
                    style={{ flex:1, padding:10, background:T.panel, border:`1.5px solid ${T.border2}`,
                      borderRadius:10, fontSize:13, fontWeight:700, color:T.muted, cursor:"pointer" }}>
                    Cancel
                  </button>
                  <button onClick={addUnit} disabled={saving}
                    style={{ flex:2, padding:10, background:T.saffron, border:"none",
                      borderRadius:10, fontSize:13, fontWeight:800, color:"#fff", cursor:"pointer",
                      display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                    {saving ? <Spinner/> : (newUnit.status||"vacant")==="occupied" ? "Save Unit + Tenant →" : "Save Unit →"}
                  </button>
                </div>
              </div>
            )}

            {/* Units list */}
            {units.length === 0 && !showAddUnit && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🏠</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No units yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Add your first flat or room above</div>
              </div>
            )}
            {units.map(u => {
              const tenant = u.tenants?.[0];
              const isOpen = selUnit?.id === u.id;
              return (
                <div key={u.id} style={{ background:T.card,
                  border:`1.5px solid ${isOpen?T.saffron:u.is_occupied?T.teal+"35":T.border}`,
                  borderRadius:14, marginBottom:11, overflow:"hidden" }}>

                  {/* Unit header — always visible */}
                  <div onClick={()=>setSelUnit(isOpen?null:u)}
                    style={{ padding:13, cursor:"pointer", display:"flex",
                      justifyContent:"space-between", alignItems:"start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <div style={{ fontSize:15, fontWeight:900, color:T.ink }}>{u.unit_number}</div>
                        <Chip label={u.is_occupied?"Occupied":"Vacant"} color={u.is_occupied?T.teal:T.rose}/>
                      </div>
                      {tenant && (
                        <div style={{ fontSize:12, fontWeight:700, color:T.ink2, marginBottom:2 }}>
                          👤 {tenant.name}
                        </div>
                      )}
                      {tenant?.lease_end && (()=>{
                        const daysLeft = Math.ceil((new Date(tenant.lease_end) - today) / (1000*60*60*24));
                        const color = daysLeft <= 15 ? T.rose : daysLeft <= 30 ? T.amber : T.teal;
                        if(daysLeft > 60) return null;
                        return (
                          <div style={{ fontSize:10, fontWeight:700, color,
                            marginBottom:2 }}>
                            🗓 Lease: {daysLeft <= 0 ? "Expired" : `${daysLeft}d left`}
                          </div>
                        );
                      })()}
                      <div style={{ fontSize:13, fontWeight:900, color:T.saffron }}>{fd(u.rent_amount)}/mo
                        {u.deposit && <span style={{ fontSize:10, color:T.muted, fontWeight:600 }}> · Deposit {fd(u.deposit)}</span>}
                      </div>
                    </div>
                    <div style={{ fontSize:16, color:T.muted, marginLeft:8 }}>{isOpen?"▲":"▼"}</div>
                  </div>

                  {/* Expanded detail */}
                  {isOpen && (
                    <div style={{ borderTop:`1px solid ${T.border}`, padding:14, background:T.panel }}>
                      {tenant ? (
                        <>
                          {/* Edit Tenant Form */}
                          {editTenant?.id === tenant.id ? (
                            <div style={{ background:T.surface, borderRadius:12, padding:14,
                              marginBottom:12, border:`1.5px solid ${T.saffron}40` }}>
                              <div style={{ fontSize:12, fontWeight:800, color:T.saffron, marginBottom:12 }}>
                                ✏️ Edit Tenant
                              </div>
                              {[
                                { label:"Name *", key:"name", type:"text", placeholder:"Tenant name" },
                                { label:"WhatsApp", key:"phone", type:"tel", placeholder:"e.g. +919876543210" },
                                { label:"Email", key:"email", type:"email", placeholder:"email@example.com" },
                                { label:"Move-in Date", key:"move_in_date", type:"date" },
                                { label:"Lease End Date", key:"lease_end", type:"date" },
                              ].map(f => (
                                <div key={f.key} style={{ marginBottom:10 }}>
                                  <div style={{ fontSize:10, fontWeight:700, color:T.muted,
                                    letterSpacing:.5, textTransform:"uppercase", marginBottom:4 }}>{f.label}</div>
                                  <input type={f.type} value={editTenant[f.key]||""}
                                    onChange={e=>setEditTenant(p=>({...p,[f.key]:e.target.value}))}
                                    placeholder={f.placeholder||""}
                                    style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                                      color:T.ink, borderRadius:9, padding:"9px 12px", fontSize:13,
                                      fontWeight:600, boxSizing:"border-box" }}/>
                                </div>
                              ))}
                              <div style={{ display:"flex", gap:8, marginTop:4 }}>
                                <button onClick={()=>setEditTenant(null)}
                                  style={{ flex:1, padding:"8px", background:T.panel,
                                    border:`1.5px solid ${T.border2}`, borderRadius:9,
                                    fontSize:12, fontWeight:700, color:T.muted, cursor:"pointer" }}>
                                  Cancel
                                </button>
                                <button onClick={async()=>{
                                  if(!editTenant.name?.trim()){ showToast("Name is required"); return; }
                                  await supabase.from("tenants").update({
                                    name: editTenant.name.trim(),
                                    phone: editTenant.phone?.trim() || null,
                                    email: editTenant.email?.trim() || null,
                                    move_in_date: editTenant.move_in_date || null,
                                    lease_end: editTenant.lease_end || null,
                                  }).eq("id", tenant.id);
                                  setEditTenant(null);
                                  showToast("Tenant updated ✓");
                                  loadData();
                                }}
                                  style={{ flex:2, padding:"8px", background:T.saffron,
                                    border:"none", borderRadius:9, fontSize:12,
                                    fontWeight:800, color:"#fff", cursor:"pointer" }}>
                                  Save Changes ✓
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {/* Tenant info card */}
                              <div style={{ background:T.surface, borderRadius:12, padding:14, marginBottom:12,
                                border:`1px solid ${T.border}` }}>
                                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 }}>
                                  <div style={{ fontSize:12, fontWeight:800, color:T.teal }}>👤 Tenant Details</div>
                                  <button onClick={()=>setEditTenant({...tenant})}
                                    style={{ background:T.saffronL, border:`1px solid ${T.saffron}30`,
                                      borderRadius:7, padding:"4px 10px", fontSize:11,
                                      fontWeight:700, color:T.saffron, cursor:"pointer" }}>
                                    ✏️ Edit
                                  </button>
                                </div>
                                {[
                                  ["Name", tenant.name],
                                  ["Phone", tenant.phone || "—"],
                                  ["Email", tenant.email || "—"],
                                  ["Move-in", fmt(tenant.move_in_date)],
                                  ["Lease ends", fmt(tenant.lease_end)],
                                ].map(([l,v]) => (
                                  <div key={l} style={{ display:"flex", justifyContent:"space-between",
                                    marginBottom:7, fontSize:12 }}>
                                    <span style={{ color:T.muted, fontWeight:600 }}>{l}</span>
                                    <span style={{ color:T.ink, fontWeight:700 }}>{v}</span>
                                  </div>
                                ))}

                                {/* Lease status badge */}
                                {tenant.lease_end && (()=>{
                                  const daysLeft = Math.ceil((new Date(tenant.lease_end) - today) / (1000*60*60*24));
                                  const color = daysLeft <= 15 ? T.rose : daysLeft <= 30 ? T.amber : daysLeft <= 60 ? T.sky : T.teal;
                                  const label = daysLeft < 0 ? "Lease expired" : daysLeft === 0 ? "Expires today" : `${daysLeft} days remaining`;
                                  return (
                                    <div style={{ marginTop:8, padding:"6px 10px",
                                      background:`${color}12`, border:`1px solid ${color}30`,
                                      borderRadius:8, fontSize:11, fontWeight:700, color }}>
                                      📅 {label}
                                    </div>
                                  );
                                })()}
                              </div>
                              <div style={{ display:"flex", gap:8 }}>
                                <button onClick={()=>vacateTenant(u.id, tenant.id)}
                                  style={{ flex:1, padding:"8px", background:T.roseL,
                                    border:`1px solid ${T.rose}30`, borderRadius:9,
                                    fontSize:12, fontWeight:700, color:T.rose, cursor:"pointer" }}>
                                  🚪 Vacated
                                </button>
                                <button onClick={async()=>{
                                  const newEnd = prompt("New lease end date (YYYY-MM-DD):", tenant.lease_end || "");
                                  if(!newEnd) return;
                                  await supabase.from("tenants").update({ lease_end:newEnd }).eq("id", tenant.id);
                                  showToast("Lease renewed ✓");
                                  loadData();
                                }}
                                  style={{ flex:1, padding:"8px", background:T.skyL,
                                    border:`1px solid ${T.sky}30`, borderRadius:9,
                                    fontSize:12, fontWeight:700, color:T.sky, cursor:"pointer" }}>
                                  🔄 Renew
                                </button>
                                <button onClick={()=>{
                                  const wa = tenant.phone?.replace(/\D/g,"");
                                  if(wa) window.open(`https://wa.me/${wa.startsWith("91")?wa:"91"+wa}?text=Hi ${tenant.name.split(" ")[0]}, this is a reminder for your rent payment. Please pay at your earliest convenience. - ${owner.name||"Your Landlord"} via RentAI`, "_blank");
                                  else showToast("No phone number saved for this tenant");
                                }} style={{ flex:1, padding:"8px", background:"#25D366",
                                  border:"none", borderRadius:9, fontSize:12,
                                  fontWeight:700, color:"#fff", cursor:"pointer" }}>
                                  📱 WA
                                </button>
                              </div>
                            </>
                          )}
                        </>
                      ) : (
                        /* Add tenant form */
                        <AddTenantForm unitId={u.id} ownerId={owner.id}
                          onSaved={()=>{ setSelUnit(null); loadData(); showToast("Tenant added ✓"); }}
                          onCancel={()=>setSelUnit(null)}/>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:T.ink }}>Payments</div>
              {verifyCount > 0 && (
                <div style={{ background:T.amber, borderRadius:20, padding:"3px 10px",
                  fontSize:11, fontWeight:800, color:"#fff" }}>
                  {verifyCount} to verify ⚡
                </div>
              )}
            </div>

            {/* Verification banner */}
            {verifyCount > 0 && (
              <div style={{ background:T.amberL, border:`1.5px solid ${T.amber}40`,
                borderRadius:14, padding:"12px 14px", marginBottom:16,
                display:"flex", alignItems:"center", gap:10 }}>
                <div style={{ fontSize:22 }}>🔔</div>
                <div>
                  <div style={{ fontSize:13, fontWeight:800, color:T.amber }}>
                    {verifyCount} payment{verifyCount>1?"s":""} awaiting your verification
                  </div>
                  <div style={{ fontSize:11, color:T.ink2, marginTop:2 }}>
                    Tenants have submitted UTR numbers — review and confirm below
                  </div>
                </div>
              </div>
            )}

            {payments.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>💰</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No payments yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Payments will appear here once tenants are added</div>
              </div>
            )}
            {payments.map(p => (
              <div key={p.id} style={{ background:T.card,
                border:`1.5px solid ${p.status==="verification_pending"?T.amber+"60":T.border}`,
                borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:4 }}>
                  <div style={{ flex:1, marginRight:8 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>
                      {p.tenants?.name || "Tenant"} · {p.units?.unit_number}
                    </div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
                      {p.type} · Due: {fmt(p.due_date)}
                    </div>
                    {p.paid_date && (
                      <div style={{ fontSize:11, color:T.teal, marginTop:1 }}>
                        Paid: {fmt(p.paid_date)}
                      </div>
                    )}
                    {p.utr_number && (
                      <div style={{ fontSize:11, fontWeight:700, color:T.amber, marginTop:3,
                        background:T.amberL, display:"inline-block",
                        padding:"2px 8px", borderRadius:6 }}>
                        UTR: {p.utr_number}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:900, color:T.ink }}>{fd(p.amount)}</div>
                    <Chip
                      label={p.status==="verification_pending"?"Verify!":p.status}
                      color={p.status==="paid"?T.teal:p.status==="verification_pending"?T.amber:p.status==="overdue"?T.rose:T.amber}
                    />
                  </div>
                </div>
                {p.status === "verification_pending" && (
                  <button onClick={()=>markPaid(p.id)}
                    style={{ width:"100%", marginTop:10, padding:"9px",
                      background:`linear-gradient(135deg,${T.amber},#F5B830)`,
                      border:"none", borderRadius:9, fontSize:13, fontWeight:800,
                      color:"#fff", cursor:"pointer" }}>
                    ✅ Verify & Mark as Paid
                  </button>
                )}
                {p.status === "pending" && (
                  <button onClick={()=>markPaid(p.id)}
                    style={{ width:"100%", marginTop:8, padding:"7px", background:T.tealL,
                      border:`1px solid ${T.teal}30`, borderRadius:8, fontSize:12,
                      fontWeight:700, color:T.teal, cursor:"pointer" }}>
                    ✓ Mark as Paid
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* EXPENSES TAB */}
        {tab === "expenses" && (
          <div style={{ padding:"18px 16px" }} className="fu">

            {/* Header row */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontWeight:800, fontSize:15, color:T.ink }}>Expenses</div>
              <button onClick={()=>setShowAddExpense(v=>!v)}
                style={{ background:T.saffron, border:"none", borderRadius:10,
                  padding:"7px 14px", fontSize:12, fontWeight:800, color:"#fff", cursor:"pointer" }}>
                {showAddExpense ? "✕ Cancel" : "+ Add Expense"}
              </button>
            </div>

            {/* Summary cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:18 }}>
              {[
                { label:"Total Spent", value:fd(totalExpenses), color:T.rose, icon:"💸" },
                { label:"Income", value:fd(totalCollected), color:T.teal, icon:"💰" },
                { label:"Net", value:fd(netIncome), color:netIncome>=0?T.teal:T.rose, icon:"📈" },
              ].map(s => (
                <div key={s.label} style={{ background:T.card, border:`1.5px solid ${s.color}25`,
                  borderRadius:13, padding:"11px 10px", textAlign:"center" }}>
                  <div style={{ fontSize:18, marginBottom:4 }}>{s.icon}</div>
                  <div style={{ fontSize:12, fontWeight:900, color:s.color }}>{s.value}</div>
                  <div style={{ fontSize:9, color:T.muted, fontWeight:700 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Add expense form */}
            {showAddExpense && (
              <div style={{ background:T.surface, border:`1.5px solid ${T.saffron}40`,
                borderRadius:16, padding:18, marginBottom:18 }} className="fu">
                <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:14 }}>New Expense</div>

                {/* Category picker */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:7 }}>Category</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:7 }}>
                    {EXP_CATEGORIES.map(c => (
                      <button key={c.value} onClick={()=>setNewExp(p=>({...p,category:c.value}))}
                        style={{ padding:"8px 10px", borderRadius:10, textAlign:"left",
                          border:`1.5px solid ${newExp.category===c.value?c.color:T.border2}`,
                          background:newExp.category===c.value?`${c.color}12`:T.panel,
                          color:newExp.category===c.value?c.color:T.muted,
                          fontSize:12, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div style={{ marginBottom:11 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:5 }}>Description *</div>
                  <input value={newExp.title}
                    onChange={e=>setNewExp(p=>({...p,title:e.target.value}))}
                    placeholder="e.g. Fixed leaking pipe in Flat 2B"
                    style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                      color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                      fontWeight:600, boxSizing:"border-box" }}/>
                </div>

                {/* Amount + Date row */}
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:11 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                      textTransform:"uppercase", marginBottom:5 }}>Amount (₹) *</div>
                    <input type="number" value={newExp.amount}
                      onChange={e=>setNewExp(p=>({...p,amount:e.target.value}))}
                      placeholder="e.g. 2500"
                      style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                        color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                        fontWeight:600, boxSizing:"border-box" }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                      textTransform:"uppercase", marginBottom:5 }}>Date</div>
                    <input type="date" value={newExp.date}
                      onChange={e=>setNewExp(p=>({...p,date:e.target.value}))}
                      style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                        color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                        fontWeight:600, boxSizing:"border-box" }}/>
                  </div>
                </div>

                {/* Unit (optional) */}
                <div style={{ marginBottom:11 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:5 }}>Unit (optional)</div>
                  <select value={newExp.unit_id}
                    onChange={e=>setNewExp(p=>({...p,unit_id:e.target.value}))}
                    style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                      color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                      fontWeight:600, boxSizing:"border-box", appearance:"none" }}>
                    <option value="">— Whole property / general —</option>
                    {units.map(u => (
                      <option key={u.id} value={u.id}>{u.unit_number}</option>
                    ))}
                  </select>
                </div>

                {/* Notes */}
                <div style={{ marginBottom:14 }}>
                  <div style={{ fontSize:10, fontWeight:700, color:T.muted, letterSpacing:.5,
                    textTransform:"uppercase", marginBottom:5 }}>Notes (optional)</div>
                  <textarea value={newExp.notes}
                    onChange={e=>setNewExp(p=>({...p,notes:e.target.value}))}
                    placeholder="Vendor name, receipt number, etc."
                    rows={2}
                    style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                      color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                      fontWeight:600, boxSizing:"border-box", resize:"none", fontFamily:"inherit" }}/>
                </div>

                <button onClick={saveExpense} disabled={savingExp}
                  style={{ width:"100%", padding:"11px", background:T.saffron, border:"none",
                    borderRadius:11, fontSize:13, fontWeight:800, color:"#fff", cursor:"pointer",
                    display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                  {savingExp ? <Spinner/> : "Save Expense →"}
                </button>
              </div>
            )}

            {/* Category breakdown bar chart */}
            {expenses.length > 0 && (()=>{
              const byCategory = EXP_CATEGORIES.map(c => ({
                ...c,
                total: expenses.filter(e=>e.category===c.value).reduce((s,e)=>s+Number(e.amount),0),
              })).filter(c => c.total > 0).sort((a,b)=>b.total-a.total);
              const maxCat = byCategory[0]?.total || 1;
              return (
                <div style={{ background:T.card, border:`1.5px solid ${T.border}`,
                  borderRadius:16, padding:16, marginBottom:18 }}>
                  <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:14 }}>
                    📊 Breakdown by Category
                  </div>
                  {byCategory.map(c => (
                    <div key={c.value} style={{ marginBottom:10 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                        <span style={{ fontSize:12, fontWeight:700, color:T.ink }}>{c.label}</span>
                        <span style={{ fontSize:12, fontWeight:900, color:c.color }}>{fd(c.total)}</span>
                      </div>
                      <div style={{ height:6, background:T.panel, borderRadius:3, overflow:"hidden" }}>
                        <div style={{ height:"100%", borderRadius:3,
                          width:`${(c.total/maxCat)*100}%`,
                          background:c.color, transition:"width .4s" }}/>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Expense list */}
            {expenses.length === 0 && !showAddExpense && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🧾</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No expenses yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Track repairs, maintenance and other costs</div>
              </div>
            )}
            {expenses.map(exp => {
              const cat = catMeta(exp.category);
              return (
                <div key={exp.id} style={{ background:T.card, border:`1.5px solid ${T.border}`,
                  borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                    <div style={{ display:"flex", gap:10, flex:1 }}>
                      <div style={{ width:36, height:36, borderRadius:10,
                        background:`${cat.color}15`, display:"flex",
                        alignItems:"center", justifyContent:"center",
                        fontSize:16, flexShrink:0 }}>
                        {cat.label.split(" ")[0]}
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{exp.title}</div>
                        <div style={{ fontSize:10, color:T.muted, marginTop:2 }}>
                          {fmt(exp.date)}
                          {exp.units?.unit_number && ` · ${exp.units.unit_number}`}
                        </div>
                        {exp.notes && (
                          <div style={{ fontSize:11, color:T.ink2, marginTop:4, lineHeight:1.5 }}>{exp.notes}</div>
                        )}
                      </div>
                    </div>
                    <div style={{ textAlign:"right", marginLeft:10 }}>
                      <div style={{ fontSize:14, fontWeight:900, color:T.rose }}>−{fd(exp.amount)}</div>
                      <Chip label={cat.value} color={cat.color}/>
                      <button onClick={()=>deleteExpense(exp.id)}
                        style={{ display:"block", marginTop:6, marginLeft:"auto",
                          background:"none", border:"none", fontSize:13,
                          color:T.muted, cursor:"pointer", padding:0 }}>
                        🗑
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              Maintenance Requests
            </div>
            {requests.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>🔧</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No requests yet</div>
                <div style={{ fontSize:12, marginTop:4 }}>Tenant requests will appear here</div>
              </div>
            )}
            {requests.map(r => (
              <div key={r.id} style={{ background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:4 }}>
                  <div style={{ flex:1, marginRight:8 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{r.title}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>
                      {r.units?.unit_number} · {fmt(r.created_at)}
                    </div>
                  </div>
                  <Chip label={r.status} color={r.status==="resolved"?T.teal:r.status==="in_progress"?T.amber:T.rose}/>
                </div>
                {r.description && (
                  <div style={{ fontSize:12, color:T.ink2, marginTop:6, lineHeight:1.5 }}>{r.description}</div>
                )}
                {r.status === "open" && (
                  <button onClick={()=>resolveRequest(r.id)}
                    style={{ marginTop:8, background:T.tealL, border:`1px solid ${T.teal}30`,
                      borderRadius:8, padding:"5px 12px", fontSize:12,
                      fontWeight:700, color:T.teal, cursor:"pointer" }}>
                    ✓ Mark Resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, maxWidth:520,
        margin:"0 auto", background:T.surface, borderTop:`1.5px solid ${T.border}`,
        zIndex:50, overflowX:"auto", WebkitOverflowScrolling:"touch" }}>
        <div style={{ display:"flex", minWidth:"max-content", width:"100%" }}>
          {tabs.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:"0 0 72px", padding:"9px 4px 10px", background:"none", border:"none",
                display:"flex", flexDirection:"column", alignItems:"center", gap:2,
                cursor:"pointer", color:tab===t.id?T.saffron:T.muted,
                fontFamily:"inherit",
                borderTop:`2.5px solid ${tab===t.id?T.saffron:"transparent"}`,
                transition:"all .15s", position:"relative" }}>
              <span style={{ fontSize:18 }}>{t.icon}</span>
              <span style={{ fontSize:8, fontWeight:800, whiteSpace:"nowrap" }}>{t.label}</span>
              {t.id === "payments" && verifyCount > 0 && (
                <div style={{ position:"absolute", top:6, right:"calc(50% - 14px)",
                  width:16, height:16, borderRadius:"50%", background:T.amber,
                  border:`2px solid ${T.surface}`, display:"flex",
                  alignItems:"center", justifyContent:"center",
                  fontSize:8, fontWeight:900, color:"#fff" }}>
                  {verifyCount}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      <Toast msg={toast}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// TENANT DASHBOARD
// ══════════════════════════════════════════════════════════════
function TenantDashboard({ tenant, onLogout }) {
  const [tab, setTab] = useState("home");
  const [payments, setPayments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [unit, setUnit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [newReq, setNewReq] = useState({ title:"", description:"", priority:"medium" });
  const [submitting, setSubmitting] = useState(false);
  const [upiModal, setUpiModal] = useState(null); // payment object or null

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null), 3000); };
  const firstName = (tenant.name||"").split(" ")[0] || "there";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [{ data: p }, { data: r }, { data: u }] = await Promise.all([
          supabase.from("payments").select("*")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending:false }),
          supabase.from("maintenance_requests").select("*, units(unit_number)")
            .eq("tenant_id", tenant.id)
            .order("created_at", { ascending:false }),
          tenant.unit_id ? supabase.from("units").select("*, properties(name, address)").eq("id", tenant.unit_id).single() : { data:null },
        ]);
        setPayments(p || []);
        setRequests(r || []);
        setUnit(u);
      } catch(e) { console.error(e); }
      setLoading(false);
    };
    load();
  }, [tenant.id, tenant.unit_id]);

  const submitRequest = async () => {
    if(!newReq.title.trim()) { showToast("Please describe the issue"); return; }
    setSubmitting(true);
    try {
      await supabase.from("maintenance_requests").insert({
        tenant_id: tenant.id,
        unit_id: tenant.unit_id || null,
        owner_id: tenant.owner_id || null,
        title: newReq.title.trim(),
        description: newReq.description.trim(),
        priority: newReq.priority,
        status: "open",
      });
      setNewReq({ title:"", description:"", priority:"medium" });
      showToast("Request submitted ✓");
      const { data: r } = await supabase.from("maintenance_requests")
        .select("*, units(unit_number)").eq("tenant_id", tenant.id)
        .order("created_at", { ascending:false });
      setRequests(r || []);
    } catch(e) { showToast("Failed to submit. Try again."); }
    setSubmitting(false);
  };

  const pending = payments.filter(p => p.status === "pending" || p.status === "verification_pending");
  const paid = payments.filter(p => p.status === "paid");
  const totalDue = pending.filter(p=>p.status==="pending").reduce((s,p) => s + Number(p.amount), 0);

  const reloadPayments = async () => {
    const { data: p } = await supabase.from("payments").select("*")
      .eq("tenant_id", tenant.id).order("created_at", { ascending:false });
    setPayments(p || []);
  };

  const generateReceipt = (p) => {
    const lines = [
      "RENTAI PAYMENT RECEIPT",
      "─────────────────────────",
      `Tenant: ${tenant.name}`,
      `Unit: ${unit?.unit_number || "—"}`,
      `Type: ${p.type}`,
      `Amount: ${fd(p.amount)}`,
      `Due Date: ${fmt(p.due_date)}`,
      `Paid Date: ${fmt(p.paid_date)}`,
      `Status: ${p.status.toUpperCase()}`,
      "─────────────────────────",
      "Powered by RentAI",
    ].join("\n");
    const blob = new Blob([lines], { type:"text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `RentAI_Receipt_${p.type}_${p.due_date}.txt`;
    a.click(); URL.revokeObjectURL(url);
    showToast("Receipt downloaded ✓");
  };

  const tabs = [
    { id:"home", icon:"🏠", label:"Home" },
    { id:"payments", icon:"💳", label:"Payments" },
    { id:"requests", icon:"🔧", label:"Requests" },
  ];

  if(loading) return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", flexDirection:"column", gap:14 }}>
      <style>{CSS}</style>
      <Spinner/>
      <div style={{ fontSize:13, color:T.muted, fontWeight:600 }}>Loading your portal…</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      color:T.ink, minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto" }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ background:T.surface, borderBottom:`1.5px solid ${T.border}`,
        padding:"11px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:9,
            background:`linear-gradient(135deg,${T.teal},${T.tealB})`,
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🏠</div>
          <div>
            <div style={{ fontWeight:900, fontSize:14, color:T.ink, letterSpacing:-.3 }}>RentAI</div>
            <div style={{ fontSize:9, color:T.muted }}>{tenant.name} · Tenant Portal</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background:T.panel, border:`1.5px solid ${T.border}`,
            borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700,
            color:T.muted, cursor:"pointer" }}>Logout</button>
      </div>

      <div style={{ flex:1, overflowY:"auto", paddingBottom:72 }}>

        {/* HOME TAB */}
        {tab === "home" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontSize:15, fontWeight:800, color:T.ink, marginBottom:14 }}>
              Hi {firstName}! 👋
            </div>

            {/* Unit info */}
            {unit ? (
              <div style={{ background:`linear-gradient(135deg,${T.teal},${T.tealB})`,
                borderRadius:18, padding:20, marginBottom:18, color:"#fff" }}>
                <div style={{ fontSize:10, fontWeight:700, opacity:.8, letterSpacing:.5, marginBottom:3 }}>
                  YOUR UNIT
                </div>
                <div style={{ fontSize:24, fontWeight:900, letterSpacing:-.8, marginBottom:4 }}>
                  {unit.unit_number}
                </div>
                {unit.properties?.name && (
                  <div style={{ fontSize:12, opacity:.85 }}>{unit.properties.name}</div>
                )}
                <div style={{ display:"flex", gap:16, marginTop:10 }}>
                  {[["Rent", fd(unit.rent_amount)+"/mo"], ["Deposit", fd(unit.deposit)], ["Due", fd(totalDue)]].map(([l,v])=>(
                    <div key={l}><div style={{ fontSize:9, opacity:.75 }}>{l}</div><div style={{ fontSize:13, fontWeight:800 }}>{v}</div></div>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background:T.panel, borderRadius:16, padding:16, marginBottom:18,
                border:`1.5px solid ${T.border}`, textAlign:"center" }}>
                <div style={{ fontSize:13, color:T.muted }}>No unit assigned yet. Your landlord will link your account.</div>
              </div>
            )}

            {/* Pending bills */}
            {pending.length > 0 && (
              <>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:10 }}>
                  Pending Bills ({pending.length})
                </div>
                {pending.map(p => (
                  <div key={p.id} style={{ background:T.card,
                    border:`1.5px solid ${p.status==="verification_pending"?T.amber+"50":T.rose+"25"}`,
                    borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                      <div>
                        <div style={{ fontSize:13, fontWeight:700, color:T.ink, textTransform:"capitalize" }}>{p.type}</div>
                        <div style={{ fontSize:11, color:T.muted }}>Due: {fmt(p.due_date)}</div>
                        {p.utr_number && (
                          <div style={{ fontSize:10, color:T.amber, fontWeight:700, marginTop:2 }}>
                            UTR: {p.utr_number}
                          </div>
                        )}
                      </div>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:18, fontWeight:900,
                          color:p.status==="verification_pending"?T.amber:T.rose }}>{fd(p.amount)}</div>
                        {p.status==="verification_pending" && (
                          <Chip label="Verifying…" color={T.amber}/>
                        )}
                      </div>
                    </div>
                    {p.status === "pending" && (
                      <button onClick={()=>setUpiModal(p)}
                        style={{ display:"block", width:"100%", padding:"9px",
                          background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                          border:"none", borderRadius:9, fontSize:13, fontWeight:800,
                          color:"#fff", textAlign:"center", cursor:"pointer" }}>
                        💳 Pay {fd(p.amount)} via UPI
                      </button>
                    )}
                    {p.status === "verification_pending" && (
                      <div style={{ padding:"8px 12px", background:T.amberL,
                        borderRadius:9, fontSize:12, fontWeight:700, color:T.amber,
                        textAlign:"center" }}>
                        ⏳ Payment submitted · Waiting for landlord to verify
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {pending.length === 0 && (
              <div style={{ background:T.tealL, border:`1px solid ${T.teal}25`,
                borderRadius:14, padding:"20px 16px", textAlign:"center", marginTop:8 }}>
                <div style={{ fontSize:24, marginBottom:8 }}>✅</div>
                <div style={{ fontSize:14, fontWeight:800, color:T.teal }}>All caught up!</div>
                <div style={{ fontSize:12, color:T.muted, marginTop:4 }}>No pending bills</div>
              </div>
            )}

            {/* Tenancy details */}
            <div style={{ background:T.card, border:`1.5px solid ${T.border}`,
              borderRadius:14, padding:16, marginTop:18 }}>
              <div style={{ fontSize:12, fontWeight:800, color:T.ink, marginBottom:12 }}>📋 Tenancy Details</div>
              {[
                ["Name", tenant.name],
                ["Phone", tenant.phone || "—"],
                ["Move-in", fmt(tenant.move_in_date)],
                ["Lease ends", fmt(tenant.lease_end)],
              ].map(([l,v]) => (
                <div key={l} style={{ display:"flex", justifyContent:"space-between", marginBottom:8, fontSize:12 }}>
                  <span style={{ color:T.muted, fontWeight:600 }}>{l}</span>
                  <span style={{ color:T.ink, fontWeight:700 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* PAYMENTS TAB */}
        {tab === "payments" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>Payment History</div>

            {payments.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>💳</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No payments yet</div>
              </div>
            )}

            {payments.map(p => (
              <div key={p.id} style={{ background:T.card, border:`1.5px solid ${
                p.status==="verification_pending"?T.amber+"40":T.border}`,
                borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:6 }}>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink, textTransform:"capitalize" }}>{p.type}</div>
                    <div style={{ fontSize:11, color:T.muted }}>Due: {fmt(p.due_date)}</div>
                    {p.paid_date && <div style={{ fontSize:11, color:T.teal }}>Paid: {fmt(p.paid_date)}</div>}
                    {p.utr_number && (
                      <div style={{ fontSize:10, color:T.amber, fontWeight:700, marginTop:2 }}>
                        UTR: {p.utr_number}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:15, fontWeight:900, color:T.ink }}>{fd(p.amount)}</div>
                    <Chip label={p.status==="verification_pending"?"Verifying":p.status}
                      color={p.status==="paid"?T.teal:p.status==="verification_pending"?T.amber:p.status==="overdue"?T.rose:T.amber}/>
                  </div>
                </div>
                <div style={{ display:"flex", gap:8, marginTop:8 }}>
                  {p.status === "pending" && (
                    <button onClick={()=>setUpiModal(p)}
                      style={{ flex:2, padding:"7px", background:T.saffron, border:"none",
                        borderRadius:8, fontSize:12, fontWeight:700, color:"#fff",
                        textAlign:"center", cursor:"pointer" }}>
                      💳 Pay via UPI
                    </button>
                  )}
                  {p.status === "verification_pending" && (
                    <div style={{ flex:2, padding:"7px", background:T.amberL,
                      border:`1px solid ${T.amber}30`, borderRadius:8,
                      fontSize:11, fontWeight:700, color:T.amber, textAlign:"center" }}>
                      ⏳ Awaiting landlord verification
                    </div>
                  )}
                  {p.status === "paid" && (
                    <button onClick={()=>generateReceipt(p)}
                      style={{ flex:1, padding:"7px", background:T.tealL,
                        border:`1px solid ${T.teal}30`, borderRadius:8,
                        fontSize:12, fontWeight:700, color:T.teal, cursor:"pointer" }}>
                      ⬇ Receipt
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS TAB */}
        {tab === "requests" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>Maintenance</div>

            {/* New request form */}
            <div style={{ background:T.surface, border:`1.5px solid ${T.border}`,
              borderRadius:16, padding:16, marginBottom:18 }}>
              <div style={{ fontSize:13, fontWeight:800, color:T.ink, marginBottom:12 }}>+ New Request</div>
              <input value={newReq.title} onChange={e=>setNewReq(p=>({...p,title:e.target.value}))}
                placeholder="e.g. Leaking tap in bathroom"
                style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                  color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                  fontWeight:600, marginBottom:10, boxSizing:"border-box" }}/>
              <textarea value={newReq.description} onChange={e=>setNewReq(p=>({...p,description:e.target.value}))}
                placeholder="Describe the issue in detail..."
                rows={2}
                style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
                  color:T.ink, borderRadius:10, padding:"10px 13px", fontSize:13,
                  fontWeight:600, marginBottom:10, boxSizing:"border-box",
                  resize:"none", fontFamily:"inherit" }}/>
              <div style={{ display:"flex", gap:7, marginBottom:12 }}>
                {[["low","🟢 Low"],["medium","🟡 Medium"],["high","🔴 High"]].map(([v,l])=>(
                  <button key={v} onClick={()=>setNewReq(p=>({...p,priority:v}))}
                    style={{ flex:1, padding:"7px 4px", borderRadius:9,
                      border:`1.5px solid ${newReq.priority===v?T.saffron:T.border2}`,
                      background:newReq.priority===v?T.saffronL:T.panel,
                      color:newReq.priority===v?T.saffron:T.muted,
                      fontSize:11, fontWeight:700, cursor:"pointer", fontFamily:"inherit" }}>{l}</button>
                ))}
              </div>
              <button onClick={submitRequest} disabled={submitting}
                style={{ width:"100%", padding:"10px", background:T.saffron, border:"none",
                  borderRadius:10, fontSize:13, fontWeight:800, color:"#fff",
                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {submitting ? <Spinner/> : "Submit Request →"}
              </button>
            </div>

            {/* Request history */}
            {requests.length === 0 && (
              <div style={{ textAlign:"center", padding:"24px 20px", color:T.muted }}>
                <div style={{ fontSize:13, fontWeight:700 }}>No requests yet</div>
              </div>
            )}
            {requests.map(r => (
              <div key={r.id} style={{ background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start", marginBottom:4 }}>
                  <div style={{ flex:1, marginRight:8 }}>
                    <div style={{ fontSize:13, fontWeight:700, color:T.ink }}>{r.title}</div>
                    <div style={{ fontSize:11, color:T.muted, marginTop:2 }}>{fmt(r.created_at)}</div>
                  </div>
                  <Chip label={r.status} color={r.status==="resolved"?T.teal:r.status==="in_progress"?T.amber:T.rose}/>
                </div>
                {r.description && (
                  <div style={{ fontSize:12, color:T.ink2, marginTop:6, lineHeight:1.5 }}>{r.description}</div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, maxWidth:520,
        margin:"0 auto", background:T.surface, borderTop:`1.5px solid ${T.border}`,
        display:"flex", zIndex:50 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)}
            style={{ flex:1, padding:"9px 4px 10px", background:"none", border:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:2,
              cursor:"pointer", color:tab===t.id?T.teal:T.muted, fontFamily:"inherit",
              borderTop:`2.5px solid ${tab===t.id?T.teal:"transparent"}`,
              transition:"all .15s" }}>
            <span style={{ fontSize:15 }}>{t.icon}</span>
            <span style={{ fontSize:8, fontWeight:800 }}>{t.label}</span>
          </button>
        ))}
      </div>
      <Toast msg={toast}/>

      {/* UPI Pay Modal */}
      {upiModal && (
        <UPIPayModal
          payment={upiModal}
          tenant={tenant}
          onClose={()=>setUpiModal(null)}
          onPaid={()=>{
            setUpiModal(null);
            showToast("Payment submitted ✓ Awaiting landlord verification");
            reloadPayments();
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ADMIN DASHBOARD
// ══════════════════════════════════════════════════════════════
function AdminDashboard({ admin, onLogout }) {
  const [tab, setTab]           = useState("overview");
  const [owners, setOwners]     = useState([]);
  const [tenants, setTenants]   = useState([]);
  const [payments, setPayments] = useState([]);
  const [requests, setRequests] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [notes, setNotes]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [toast, setToast]       = useState(null);
  const [search, setSearch]     = useState("");
  const [selOwner, setSelOwner] = useState(null);
  const [selTenant, setSelTenant] = useState(null);
  const [newNote, setNewNote]   = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const showToast = (msg) => { setToast(msg); setTimeout(()=>setToast(null),3000); };

  const [confirmDelete, setConfirmDelete] = useState(null); // owner object to confirm deletion
  const [deleting, setDeleting] = useState(false);
  const [units, setUnits] = useState([]);

  const deleteOwner = async (owner) => {
    setDeleting(true);
    try {
      // Delete in order: payments → expenses → maintenance_requests → tenants → units → properties → owner
      const { data: ownerUnits } = await supabase.from("units").select("id").eq("owner_id", owner.id);
      const unitIds = (ownerUnits||[]).map(u=>u.id);

      if(unitIds.length > 0) {
        await supabase.from("payments").delete().in("unit_id", unitIds);
        await supabase.from("maintenance_requests").delete().in("unit_id", unitIds);
        await supabase.from("tenants").delete().eq("owner_id", owner.id);
        await supabase.from("units").delete().eq("owner_id", owner.id);
      }
      await supabase.from("expenses").delete().eq("owner_id", owner.id);
      await supabase.from("properties").delete().eq("owner_id", owner.id);
      await supabase.from("support_notes").delete().eq("entity_id", owner.id);
      await supabase.from("owners").delete().eq("id", owner.id);

      setConfirmDelete(null);
      setSelOwner(null);
      showToast(`${owner.name} deleted ✓`);
      loadAll();
    } catch(e) {
      showToast("Delete failed: " + (e?.message||"unknown"));
    }
    setDeleting(false);
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [{ data: o }, { data: t }, { data: p }, { data: r }, { data: e }, { data: n }, { data: u }] = await Promise.all([
        supabase.from("owners").select("*").order("created_at", { ascending:false }),
        supabase.from("tenants").select("*, units(unit_number, rent_amount)").order("created_at", { ascending:false }),
        supabase.from("payments").select("*, units(unit_number), tenants(name), owners(name)").order("created_at", { ascending:false }).limit(200),
        supabase.from("maintenance_requests").select("*, units(unit_number), tenants(name)").order("created_at", { ascending:false }).limit(200),
        supabase.from("expenses").select("*, units(unit_number), owners(name)").order("date", { ascending:false }).limit(200),
        supabase.from("support_notes").select("*").order("created_at", { ascending:false }),
        supabase.from("units").select("*, tenants(name, is_active)").order("created_at", { ascending:false }),
      ]);
      setOwners(o||[]); setTenants(t||[]); setPayments(p||[]);
      setRequests(r||[]); setExpenses(e||[]); setNotes(n||[]);
      setUnits(u||[]);
    } catch(err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const addNote = async (entityType, entityId) => {
    if(!newNote.trim()) return;
    setSavingNote(true);
    try {
      await supabase.from("support_notes").insert({
        admin_phone: admin.phone,
        admin_name:  admin.name,
        entity_type: entityType,
        entity_id:   entityId,
        note:        newNote.trim(),
      });
      setNewNote("");
      showToast("Note added ✓");
      const { data: n } = await supabase.from("support_notes").select("*").order("created_at", { ascending:false });
      setNotes(n||[]);
    } catch(e) { showToast("Failed to save note"); }
    setSavingNote(false);
  };

  const totalRentRoll    = owners.reduce((s,o) => s, 0); // computed below
  const totalPayments    = payments.filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0);
  const pendingCount     = payments.filter(p=>p.status==="pending").length;
  const verifyCount      = payments.filter(p=>p.status==="verification_pending").length;
  const openRequests     = requests.filter(r=>r.status==="open").length;
  const activeOwners     = owners.length;
  const activeTenants    = tenants.filter(t=>t.is_active).length;
  const totalExpenses    = expenses.reduce((s,e)=>s+Number(e.amount),0);

  const filterStr = search.toLowerCase();
  const filteredOwners  = owners.filter(o =>
    o.name?.toLowerCase().includes(filterStr) || o.phone?.includes(filterStr) || o.city?.toLowerCase().includes(filterStr));
  const filteredTenants = tenants.filter(t =>
    t.name?.toLowerCase().includes(filterStr) || t.phone?.includes(filterStr));

  const notesFor = (type, id) => notes.filter(n => n.entity_type === type && n.entity_id === id);

  const ATABS = [
    { id:"overview",  icon:"📊", label:"Overview"  },
    { id:"owners",    icon:"🏢", label:"Owners"    },
    { id:"tenants",   icon:"👥", label:"Tenants"   },
    { id:"payments",  icon:"💰", label:"Payments"  },
    { id:"requests",  icon:"🔧", label:"Requests"  },
    { id:"expenses",  icon:"🧾", label:"Expenses"  },
    { id:"cleanup",   icon:"🗑",  label:"Cleanup"   },
  ];

  // ── Detail panel for owner ──────────────────────────────────
  const OwnerPanel = ({ owner }) => {
    const ownerNotes    = notesFor("owner", owner.id);
    const ownerPayments = payments.filter(p => p.owner_id === owner.id);
    const ownerUnits    = units.filter(u => u.owner_id === owner.id);
    const ownerTenants  = tenants.filter(t => t.owner_id === owner.id);
    const ownerRequests = requests.filter(r => r.owner_id === owner.id);
    const ownerExpenses = expenses.filter(e => e.owner_id === owner.id);
    const [panelTab, setPanelTab] = useState("overview");

    const PTABS = [
      { id:"overview", label:"Overview" },
      { id:"units",    label:`Units (${ownerUnits.length})` },
      { id:"payments", label:`Payments (${ownerPayments.length})` },
      { id:"requests", label:`Requests (${ownerRequests.length})` },
      { id:"notes",    label:`Notes (${ownerNotes.length})` },
    ];

    return (
      <div style={{ position:"fixed", inset:0, zIndex:8000, background:"rgba(0,0,0,.55)",
        display:"flex", alignItems:"flex-end", justifyContent:"center" }}
        onClick={e=>{ if(e.target===e.currentTarget) setSelOwner(null); }}>
        <div className="fu" style={{ background:T.surface, borderRadius:"22px 22px 0 0",
          width:"100%", maxWidth:520, maxHeight:"90vh", overflowY:"auto",
          padding:"20px 18px 36px", boxShadow:"0 -8px 40px rgba(0,0,0,.2)" }}>
          <div style={{ width:40, height:4, borderRadius:2, background:T.border2, margin:"0 auto 16px" }}/>

          {/* Owner header */}
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
            <div style={{ width:48, height:48, borderRadius:14,
              background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, fontWeight:900, color:"#fff", flexShrink:0 }}>
              {(owner.name||"?")[0].toUpperCase()}
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:16, fontWeight:900, color:T.ink }}>{owner.name}</div>
              <div style={{ fontSize:12, color:T.muted }}>{owner.phone} · {owner.city||"—"}</div>
              <div style={{ fontSize:10, color:T.muted }}>Joined {fmt(owner.created_at)}</div>
            </div>
            <button onClick={()=>setConfirmDelete(owner)}
              style={{ background:T.roseL, border:`1px solid ${T.rose}30`,
                borderRadius:9, padding:"6px 12px", fontSize:11,
                fontWeight:800, color:T.rose, cursor:"pointer" }}>
              🗑 Delete
            </button>
          </div>

          {/* Panel tabs */}
          <div style={{ display:"flex", gap:0, marginBottom:16, overflowX:"auto",
            borderBottom:`1.5px solid ${T.border}` }}>
            {PTABS.map(t=>(
              <button key={t.id} onClick={()=>setPanelTab(t.id)}
                style={{ flex:"0 0 auto", padding:"7px 12px", background:"none", border:"none",
                  borderBottom:`2.5px solid ${panelTab===t.id?T.plum:"transparent"}`,
                  color:panelTab===t.id?T.plum:T.muted, fontFamily:"inherit",
                  fontSize:11, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
                {t.label}
              </button>
            ))}
          </div>

          {/* OVERVIEW */}
          {panelTab === "overview" && (
            <>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:16 }}>
                {[
                  { label:"Units",    v: ownerUnits.length,      color:T.saffron },
                  { label:"Tenants",  v: ownerTenants.filter(t=>t.is_active).length, color:T.teal },
                  { label:"Collected",v: fd(ownerPayments.filter(p=>p.status==="paid").reduce((s,p)=>s+Number(p.amount),0)), color:T.teal },
                  { label:"Pending",  v: ownerPayments.filter(p=>p.status==="pending").length+" bills", color:T.rose },
                  { label:"Verify",   v: ownerPayments.filter(p=>p.status==="verification_pending").length, color:T.amber },
                  { label:"Expenses", v: fd(ownerExpenses.reduce((s,e)=>s+Number(e.amount),0)), color:T.rose },
                ].map(s=>(
                  <div key={s.label} style={{ background:T.panel, borderRadius:11, padding:"10px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:13, fontWeight:900, color:s.color }}>{s.v}</div>
                    <div style={{ fontSize:9, color:T.muted, fontWeight:700 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              {/* Open requests */}
              {ownerRequests.filter(r=>r.status==="open").length > 0 && (
                <div style={{ background:T.roseL, border:`1px solid ${T.rose}25`,
                  borderRadius:11, padding:"10px 13px", marginBottom:12 }}>
                  <div style={{ fontSize:12, fontWeight:800, color:T.rose, marginBottom:6 }}>
                    🔧 {ownerRequests.filter(r=>r.status==="open").length} Open Maintenance Request(s)
                  </div>
                  {ownerRequests.filter(r=>r.status==="open").map(r=>(
                    <div key={r.id} style={{ fontSize:11, color:T.ink, marginBottom:3 }}>
                      • {r.title} — <span style={{ color:T.muted }}>{r.units?.unit_number}</span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {/* UNITS */}
          {panelTab === "units" && (
            ownerUnits.length === 0
              ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No units</div>
              : ownerUnits.map(u=>(
                <div key={u.id} style={{ background:T.panel, borderRadius:11, padding:"10px 13px",
                  marginBottom:9, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{u.unit_number}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{fd(u.rent_amount)}/mo · {u.type}</div>
                      {u.tenants?.[0] && (
                        <div style={{ fontSize:11, color:T.teal, marginTop:2 }}>👤 {u.tenants[0].name}</div>
                      )}
                    </div>
                    <Chip label={u.is_occupied?"Occupied":"Vacant"} color={u.is_occupied?T.teal:T.rose}/>
                  </div>
                </div>
              ))
          )}

          {/* PAYMENTS */}
          {panelTab === "payments" && (
            ownerPayments.length === 0
              ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No payments</div>
              : ownerPayments.slice(0,20).map(p=>(
                <div key={p.id} style={{ background:T.panel, borderRadius:11, padding:"10px 13px",
                  marginBottom:9, border:`1px solid ${p.status==="verification_pending"?T.amber+"40":T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>
                        {p.tenants?.name||"—"} · {p.units?.unit_number||"—"}
                      </div>
                      <div style={{ fontSize:10, color:T.muted }}>{p.type} · {fmt(p.due_date)}</div>
                      {p.utr_number && <div style={{ fontSize:10, color:T.amber }}>UTR: {p.utr_number}</div>}
                    </div>
                    <div style={{ textAlign:"right" }}>
                      <div style={{ fontSize:13, fontWeight:900, color:T.ink }}>{fd(p.amount)}</div>
                      <Chip label={p.status==="verification_pending"?"Verify":p.status}
                        color={p.status==="paid"?T.teal:p.status==="verification_pending"?T.amber:T.rose}/>
                    </div>
                  </div>
                </div>
              ))
          )}

          {/* REQUESTS */}
          {panelTab === "requests" && (
            ownerRequests.length === 0
              ? <div style={{ fontSize:12, color:T.muted, textAlign:"center", padding:"20px 0" }}>No requests</div>
              : ownerRequests.map(r=>(
                <div key={r.id} style={{ background:T.panel, borderRadius:11, padding:"10px 13px",
                  marginBottom:9, border:`1px solid ${T.border}` }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                    <div>
                      <div style={{ fontSize:12, fontWeight:700, color:T.ink }}>{r.title}</div>
                      <div style={{ fontSize:10, color:T.muted }}>{r.units?.unit_number} · {fmt(r.created_at)}</div>
                    </div>
                    <Chip label={r.status} color={r.status==="resolved"?T.teal:r.status==="in_progress"?T.amber:T.rose}/>
                  </div>
                </div>
              ))
          )}

          {/* NOTES */}
          {panelTab === "notes" && (
            <>
              {ownerNotes.length === 0 && (
                <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>No notes yet</div>
              )}
              {ownerNotes.map(n=>(
                <div key={n.id} style={{ background:T.panel, borderRadius:10, padding:"9px 12px",
                  marginBottom:8, border:`1px solid ${T.border}` }}>
                  <div style={{ fontSize:12, color:T.ink, lineHeight:1.5 }}>{n.note}</div>
                  <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{n.admin_name} · {fmt(n.created_at)}</div>
                </div>
              ))}
              <div style={{ display:"flex", gap:8, marginTop:8 }}>
                <input value={newNote} onChange={e=>setNewNote(e.target.value)}
                  placeholder="Add a support note…"
                  style={{ flex:1, background:T.panel, border:`1.5px solid ${T.border2}`,
                    color:T.ink, borderRadius:10, padding:"9px 12px", fontSize:12, fontWeight:600 }}/>
                <button onClick={()=>addNote("owner", owner.id)} disabled={savingNote||!newNote.trim()}
                  style={{ background:T.saffron, border:"none", borderRadius:10,
                    padding:"9px 14px", fontSize:12, fontWeight:800, color:"#fff", cursor:"pointer" }}>
                  {savingNote ? "…" : "Save"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // ── Detail panel for tenant ─────────────────────────────────
  const TenantPanel = ({ tenant }) => {
    const tNotes = notesFor("tenant", tenant.id);
    return (
      <div style={{ position:"fixed", inset:0, zIndex:8000, background:"rgba(0,0,0,.5)",
        display:"flex", alignItems:"flex-end", justifyContent:"center" }}
        onClick={e=>{ if(e.target===e.currentTarget) setSelTenant(null); }}>
        <div className="fu" style={{ background:T.surface, borderRadius:"22px 22px 0 0",
          width:"100%", maxWidth:520, maxHeight:"85vh", overflowY:"auto",
          padding:"20px 18px 36px", boxShadow:"0 -8px 40px rgba(0,0,0,.2)" }}>
          <div style={{ width:40, height:4, borderRadius:2, background:T.border2, margin:"0 auto 18px" }}/>
          <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
            <div style={{ width:48, height:48, borderRadius:14, background:`linear-gradient(135deg,${T.teal},${T.tealB})`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:20, fontWeight:900, color:"#fff", flexShrink:0 }}>
              {(tenant.name||"?")[0].toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize:16, fontWeight:900, color:T.ink }}>{tenant.name}</div>
              <div style={{ fontSize:12, color:T.muted }}>{tenant.phone||"—"} · {tenant.units?.unit_number||"No unit"}</div>
              <div style={{ fontSize:10, color:T.muted }}>
                {tenant.is_active ? "🟢 Active" : "🔴 Inactive"} · Joined {fmt(tenant.created_at)}
              </div>
            </div>
          </div>
          <div style={{ fontSize:12, fontWeight:800, color:T.ink, marginBottom:10 }}>🗒 Support Notes</div>
          {tNotes.length === 0 && <div style={{ fontSize:12, color:T.muted, marginBottom:12 }}>No notes yet</div>}
          {tNotes.map(n=>(
            <div key={n.id} style={{ background:T.panel, borderRadius:10, padding:"9px 12px", marginBottom:8, border:`1px solid ${T.border}` }}>
              <div style={{ fontSize:12, color:T.ink, lineHeight:1.5 }}>{n.note}</div>
              <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{n.admin_name} · {fmt(n.created_at)}</div>
            </div>
          ))}
          <div style={{ display:"flex", gap:8, marginTop:8 }}>
            <input value={newNote} onChange={e=>setNewNote(e.target.value)}
              placeholder="Add a support note…"
              style={{ flex:1, background:T.panel, border:`1.5px solid ${T.border2}`,
                color:T.ink, borderRadius:10, padding:"9px 12px", fontSize:12, fontWeight:600 }}/>
            <button onClick={()=>addNote("tenant", tenant.id)} disabled={savingNote||!newNote.trim()}
              style={{ background:T.teal, border:"none", borderRadius:10,
                padding:"9px 14px", fontSize:12, fontWeight:800, color:"#fff", cursor:"pointer" }}>
              {savingNote ? "…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    );
  };

  if(loading) return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      flexDirection:"column", gap:14 }}>
      <style>{CSS}</style>
      <Spinner/>
      <div style={{ fontSize:13, color:T.muted }}>Loading admin data…</div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:T.bg,
      color:T.ink, minHeight:"100vh", display:"flex", flexDirection:"column", maxWidth:520, margin:"0 auto" }}>
      <style>{CSS}</style>

      {/* Top bar */}
      <div style={{ background:`linear-gradient(135deg,${T.plum},#6D28D9)`,
        padding:"11px 16px", display:"flex", alignItems:"center",
        justifyContent:"space-between", position:"sticky", top:0, zIndex:50 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:30, height:30, borderRadius:9, background:"rgba(255,255,255,.2)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:15 }}>🛡</div>
          <div>
            <div style={{ fontWeight:900, fontSize:14, color:"#fff", letterSpacing:-.3 }}>RentAI Admin</div>
            <div style={{ fontSize:9, color:"rgba(255,255,255,.7)" }}>{admin.name} · {admin.role}</div>
          </div>
        </div>
        <button onClick={onLogout}
          style={{ background:"rgba(255,255,255,.15)", border:"1px solid rgba(255,255,255,.3)",
            borderRadius:8, padding:"5px 12px", fontSize:11, fontWeight:700, color:"#fff", cursor:"pointer" }}>
          Logout
        </button>
      </div>

      {/* Search bar */}
      <div style={{ padding:"12px 16px 0", background:T.surface,
        borderBottom:`1px solid ${T.border}` }}>
        <input value={search} onChange={e=>setSearch(e.target.value)}
          placeholder="🔍 Search owners, tenants, phone…"
          style={{ width:"100%", background:T.panel, border:`1.5px solid ${T.border2}`,
            color:T.ink, borderRadius:11, padding:"9px 14px", fontSize:13,
            fontWeight:600, boxSizing:"border-box" }}/>
        <div style={{ display:"flex", gap:0, marginTop:10, overflowX:"auto",
          WebkitOverflowScrolling:"touch" }}>
          {ATABS.map(t => (
            <button key={t.id} onClick={()=>setTab(t.id)}
              style={{ flex:"0 0 auto", padding:"7px 14px", background:"none", border:"none",
                borderBottom:`2.5px solid ${tab===t.id?T.plum:"transparent"}`,
                color:tab===t.id?T.plum:T.muted, fontFamily:"inherit",
                fontSize:12, fontWeight:800, cursor:"pointer", whiteSpace:"nowrap" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1, overflowY:"auto", paddingBottom:32 }}>

        {/* OVERVIEW */}
        {tab === "overview" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>Platform Overview</div>

            {/* KPI grid */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 }}>
              {[
                { label:"Property Owners",    v: activeOwners,       icon:"🏢", color:T.saffron },
                { label:"Active Tenants",     v: activeTenants,      icon:"👥", color:T.teal },
                { label:"Total Collected",    v: fd(totalPayments),  icon:"💰", color:T.teal },
                { label:"Pending Bills",      v: pendingCount,       icon:"⏳", color:T.rose },
                { label:"Verify Queue",       v: verifyCount,        icon:"⚡", color:T.amber },
                { label:"Open Requests",      v: openRequests,       icon:"🔧", color:T.sky },
                { label:"Total Expenses",     v: fd(totalExpenses),  icon:"💸", color:T.rose },
                { label:"Support Notes",      v: notes.length,       icon:"🗒",  color:T.plum },
              ].map(s => (
                <div key={s.label} style={{ background:T.card, border:`1.5px solid ${s.color}20`,
                  borderRadius:14, padding:"13px 14px" }}>
                  <div style={{ fontSize:20, marginBottom:6 }}>{s.icon}</div>
                  <div style={{ fontSize:18, fontWeight:900, color:s.color }}>{s.v}</div>
                  <div style={{ fontSize:11, color:T.muted, fontWeight:700 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent support notes */}
            {notes.length > 0 && (
              <>
                <div style={{ fontWeight:800, fontSize:13, color:T.ink, marginBottom:10 }}>Recent Notes</div>
                {notes.slice(0,5).map(n=>(
                  <div key={n.id} style={{ background:T.card, border:`1.5px solid ${T.plum}20`,
                    borderRadius:12, padding:"10px 13px", marginBottom:8 }}>
                    <div style={{ fontSize:11, fontWeight:800, color:T.plum, marginBottom:4 }}>
                      {n.entity_type === "owner" ? "🏢 Owner" : "👤 Tenant"} · {n.admin_name}
                    </div>
                    <div style={{ fontSize:12, color:T.ink, lineHeight:1.5 }}>{n.note}</div>
                    <div style={{ fontSize:10, color:T.muted, marginTop:4 }}>{fmt(n.created_at)}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {/* OWNERS */}
        {tab === "owners" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              Owners ({filteredOwners.length})
            </div>
            {filteredOwners.map(o => (
              <div key={o.id} onClick={()=>{ setSelOwner(o); setNewNote(""); }}
                style={{ background:T.card, border:`1.5px solid ${T.border}`,
                  borderRadius:13, padding:"12px 14px", marginBottom:10, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                  <div style={{ display:"flex", gap:10, flex:1 }}>
                    <div style={{ width:38, height:38, borderRadius:11,
                      background:`linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:15, fontWeight:900, color:"#fff", flexShrink:0 }}>
                      {(o.name||"?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{o.name}</div>
                      <div style={{ fontSize:11, color:T.muted }}>{o.phone} · {o.city||"—"}</div>
                      <div style={{ fontSize:10, color:T.muted }}>Joined {fmt(o.created_at)}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    {notesFor("owner",o.id).length > 0 && (
                      <Chip label={`${notesFor("owner",o.id).length} notes`} color={T.plum}/>
                    )}
                    <span style={{ fontSize:18, color:T.muted }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* TENANTS */}
        {tab === "tenants" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              Tenants ({filteredTenants.length})
            </div>
            {filteredTenants.map(t => (
              <div key={t.id} onClick={()=>{ setSelTenant(t); setNewNote(""); }}
                style={{ background:T.card, border:`1.5px solid ${T.border}`,
                  borderRadius:13, padding:"12px 14px", marginBottom:10, cursor:"pointer" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <div style={{ display:"flex", gap:10, flex:1 }}>
                    <div style={{ width:38, height:38, borderRadius:11,
                      background:`linear-gradient(135deg,${T.teal},${T.tealB})`,
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:15, fontWeight:900, color:"#fff", flexShrink:0 }}>
                      {(t.name||"?")[0].toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{t.name}</div>
                      <div style={{ fontSize:11, color:T.muted }}>
                        {t.phone||"No phone"} · {t.units?.unit_number||"No unit"}
                      </div>
                      <div style={{ fontSize:10, color:t.is_active?T.teal:T.rose, fontWeight:700 }}>
                        {t.is_active ? "Active" : "Inactive"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}>
                    {notesFor("tenant",t.id).length > 0 && (
                      <Chip label={`${notesFor("tenant",t.id).length} notes`} color={T.plum}/>
                    )}
                    <span style={{ fontSize:18, color:T.muted }}>›</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* PAYMENTS */}
        {tab === "payments" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              All Payments ({payments.length})
            </div>
            {/* Filter chips */}
            {["all","pending","verification_pending","paid"].map(s=>(
              <span key={s} onClick={()=>setSearch(s==="all"?"":s)}
                style={{ display:"inline-block", marginRight:6, marginBottom:12,
                  padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:700,
                  cursor:"pointer",
                  background: search===s||(!search&&s==="all")?T.plum:T.panel,
                  color: search===s||(!search&&s==="all")?"#fff":T.muted,
                  border:`1px solid ${search===s||(!search&&s==="all")?T.plum:T.border2}` }}>
                {s==="all"?"All":s==="verification_pending"?"Verify":s}
              </span>
            ))}
            {payments
              .filter(p => !search || p.status===search ||
                p.tenants?.name?.toLowerCase().includes(filterStr) ||
                p.owners?.name?.toLowerCase().includes(filterStr))
              .slice(0,100)
              .map(p=>(
              <div key={p.id} style={{ background:T.card,
                border:`1.5px solid ${p.status==="verification_pending"?T.amber+"50":p.status==="paid"?T.teal+"25":T.border}`,
                borderRadius:13, padding:"11px 13px", marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:T.ink }}>
                      {p.tenants?.name||"—"} · {p.units?.unit_number||"—"}
                    </div>
                    <div style={{ fontSize:11, color:T.muted }}>
                      {p.type} · Due {fmt(p.due_date)}
                      {p.paid_date && ` · Paid ${fmt(p.paid_date)}`}
                    </div>
                    {p.utr_number && (
                      <div style={{ fontSize:10, color:T.amber, fontWeight:700 }}>UTR: {p.utr_number}</div>
                    )}
                    <div style={{ fontSize:10, color:T.muted }}>Owner: {p.owners?.name||"—"}</div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <div style={{ fontSize:14, fontWeight:900, color:T.ink }}>{fd(p.amount)}</div>
                    <Chip label={p.status==="verification_pending"?"Verify":p.status}
                      color={p.status==="paid"?T.teal:p.status==="verification_pending"?T.amber:T.rose}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* REQUESTS */}
        {tab === "requests" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              Maintenance Requests ({requests.length})
            </div>
            {requests.filter(r =>
              !filterStr || r.title?.toLowerCase().includes(filterStr) ||
              r.tenants?.name?.toLowerCase().includes(filterStr)
            ).map(r=>(
              <div key={r.id} style={{ background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:13, padding:"11px 13px", marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                  <div style={{ flex:1, marginRight:8 }}>
                    <div style={{ fontSize:12, fontWeight:800, color:T.ink }}>{r.title}</div>
                    <div style={{ fontSize:11, color:T.muted }}>
                      {r.tenants?.name||"—"} · {r.units?.unit_number||"—"} · {fmt(r.created_at)}
                    </div>
                    {r.description && (
                      <div style={{ fontSize:11, color:T.ink2, marginTop:4, lineHeight:1.5 }}>{r.description}</div>
                    )}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
                    <Chip label={r.priority} color={r.priority==="high"?T.rose:r.priority==="medium"?T.amber:T.teal}/>
                    <Chip label={r.status} color={r.status==="resolved"?T.teal:r.status==="in_progress"?T.amber:T.rose}/>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* EXPENSES */}
        {tab === "expenses" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:14 }}>
              All Expenses ({expenses.length}) · {fd(totalExpenses)} total
            </div>
            {expenses.filter(e =>
              !filterStr || e.title?.toLowerCase().includes(filterStr) ||
              e.owners?.name?.toLowerCase().includes(filterStr)
            ).map(e=>(
              <div key={e.id} style={{ background:T.card, border:`1.5px solid ${T.border}`,
                borderRadius:13, padding:"11px 13px", marginBottom:9 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                  <div>
                    <div style={{ fontSize:12, fontWeight:800, color:T.ink }}>{e.title}</div>
                    <div style={{ fontSize:11, color:T.muted }}>
                      {e.category} · {fmt(e.date)}
                      {e.units?.unit_number && ` · ${e.units.unit_number}`}
                    </div>
                    <div style={{ fontSize:10, color:T.muted }}>Owner: {e.owners?.name||"—"}</div>
                    {e.notes && <div style={{ fontSize:11, color:T.ink2, marginTop:3 }}>{e.notes}</div>}
                  </div>
                  <div style={{ fontSize:14, fontWeight:900, color:T.rose }}>−{fd(e.amount)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CLEANUP TAB */}
        {tab === "cleanup" && (
          <div style={{ padding:"18px 16px" }} className="fu">
            <div style={{ fontWeight:800, fontSize:15, color:T.ink, marginBottom:6 }}>🗑 Account Cleanup</div>
            <div style={{ fontSize:12, color:T.muted, marginBottom:18 }}>
              Delete test or inactive accounts and all their associated data permanently.
            </div>

            {/* Warning banner */}
            <div style={{ background:T.roseL, border:`1.5px solid ${T.rose}30`,
              borderRadius:13, padding:"12px 14px", marginBottom:18 }}>
              <div style={{ fontSize:12, fontWeight:800, color:T.rose, marginBottom:4 }}>
                ⚠️ Irreversible Action
              </div>
              <div style={{ fontSize:11, color:T.ink2, lineHeight:1.6 }}>
                Deleting an owner removes all their units, tenants, payments, expenses and maintenance requests permanently. This cannot be undone.
              </div>
            </div>

            {/* Owner list with delete buttons */}
            {owners.map(o => {
              const oUnits    = units.filter(u => u.owner_id === o.id);
              const oTenants  = tenants.filter(t => t.owner_id === o.id && t.is_active);
              const oPayments = payments.filter(p => p.owner_id === o.id);
              const isTestAccount = !oUnits.length && !oTenants.length;
              return (
                <div key={o.id} style={{ background:T.card,
                  border:`1.5px solid ${isTestAccount?T.rose+"30":T.border}`,
                  borderRadius:13, padding:"12px 14px", marginBottom:10 }}>
                  <div style={{ display:"flex", justifyContent:"space-between", alignItems:"start" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4 }}>
                        <div style={{ fontSize:13, fontWeight:800, color:T.ink }}>{o.name}</div>
                        {isTestAccount && <Chip label="No data" color={T.rose}/>}
                      </div>
                      <div style={{ fontSize:11, color:T.muted }}>{o.phone} · {o.city||"—"}</div>
                      <div style={{ fontSize:10, color:T.muted, marginTop:3 }}>
                        {oUnits.length} units · {oTenants.length} active tenants · {oPayments.length} payments
                      </div>
                      <div style={{ fontSize:10, color:T.muted }}>Joined {fmt(o.created_at)}</div>
                    </div>
                    <button onClick={()=>setConfirmDelete(o)}
                      style={{ background:T.roseL, border:`1px solid ${T.rose}30`,
                        borderRadius:9, padding:"6px 12px", fontSize:11,
                        fontWeight:800, color:T.rose, cursor:"pointer", flexShrink:0 }}>
                      🗑 Delete
                    </button>
                  </div>
                </div>
              );
            })}

            {owners.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 20px", color:T.muted }}>
                <div style={{ fontSize:32, marginBottom:10 }}>✅</div>
                <div style={{ fontSize:14, fontWeight:700 }}>No accounts to clean up</div>
              </div>
            )}
          </div>
        )}

      </div>

      {/* Confirm delete modal */}
      {confirmDelete && (
        <div style={{ position:"fixed", inset:0, zIndex:9000, background:"rgba(0,0,0,.6)",
          display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div className="fu" style={{ background:T.surface, borderRadius:20,
            padding:24, width:"100%", maxWidth:400,
            boxShadow:"0 8px 40px rgba(0,0,0,.25)" }}>
            <div style={{ fontSize:32, textAlign:"center", marginBottom:12 }}>⚠️</div>
            <div style={{ fontSize:16, fontWeight:900, color:T.ink, textAlign:"center", marginBottom:8 }}>
              Delete {confirmDelete.name}?
            </div>
            <div style={{ fontSize:12, color:T.muted, textAlign:"center", lineHeight:1.6, marginBottom:20 }}>
              This will permanently delete this owner and ALL their units, tenants, payments, expenses and requests. This cannot be undone.
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={()=>setConfirmDelete(null)} disabled={deleting}
                style={{ flex:1, padding:"11px", background:T.panel,
                  border:`1.5px solid ${T.border2}`, borderRadius:11,
                  fontSize:13, fontWeight:700, color:T.muted, cursor:"pointer" }}>
                Cancel
              </button>
              <button onClick={()=>deleteOwner(confirmDelete)} disabled={deleting}
                style={{ flex:1, padding:"11px", background:T.rose,
                  border:"none", borderRadius:11, fontSize:13,
                  fontWeight:800, color:"#fff", cursor:"pointer",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                {deleting ? <Spinner/> : "Yes, Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail panels */}
      {selOwner  && <OwnerPanel  owner={selOwner}/>}
      {selTenant && <TenantPanel tenant={selTenant}/>}
      <Toast msg={toast}/>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ROOT APP
// ══════════════════════════════════════════════════════════════
export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  useEffect(() => {
    const saved = localStorage.getItem("rentai_user");
    if(saved) {
      try {
        const parsed = JSON.parse(saved);
        // Check session expiry
        if(!parsed.session_exp || Date.now() > parsed.session_exp) {
          localStorage.removeItem("rentai_user");
          setChecking(false);
          return;
        }
        // Admin — no DB lookup needed, phone is the identity
        if(parsed.type === "admin") {
          setUser(parsed);
          setChecking(false);
          return;
        }
        const table = parsed.type === "tenant" ? "tenants" : "owners";
        supabase.from(table).select("*").eq("id", parsed.id).single()
          .then(({ data }) => {
            if(data) setUser({ type: parsed.type, session_exp: parsed.session_exp, ...data });
            setChecking(false);
          });
      } catch { localStorage.removeItem("rentai_user"); setChecking(false); }
    } else { setChecking(false); }
  }, []);

  const handleLogin = (userData) => {
    const session = { ...userData, session_exp: Date.now() + SESSION_TTL_MS };
    localStorage.setItem("rentai_user", JSON.stringify(session));
    setUser(session);
  };

  const handleLogout = () => {
    localStorage.removeItem("rentai_user");
    setUser(null);
  };

  if(checking) return (
    <div style={{ fontFamily:"'Nunito','Segoe UI',sans-serif", background:"#FAFAF7",
      minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center" }}>
      <style>{CSS}</style>
      <Spinner/>
    </div>
  );

  if(user?.type === "admin")  return <AdminDashboard admin={user} onLogout={handleLogout}/>;
  if(user?.type === "tenant") return <TenantDashboard tenant={user} onLogout={handleLogout}/>;
  if(user?.type === "owner")  return <OwnerDashboard owner={user} onLogout={handleLogout}/>;
  return <LoginScreen onLogin={handleLogin}/>;
}

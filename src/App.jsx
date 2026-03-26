// ══════════════════════════════════════════════════════════════
// LOGIN SCREEN  –  Email OTP (Beta)
// Replace the entire LoginScreen function in App_3.jsx with this
// ══════════════════════════════════════════════════════════════
function LoginScreen({ onLogin }) {
  const [step, setStep]               = useState("phone");   // "phone" | "otp" | "role" | "profile"
  const [email, setEmail]             = useState("");
  const [phone, setPhone]             = useState("");         // captured for future SMS/WA use
  const [otp, setOtp]                 = useState("");
  const [name, setName]               = useState("");
  const [city, setCity]               = useState("Bengaluru");
  const [role, setRole]               = useState("owner");
  const [loading, setLoading]         = useState(false);
  const [error, setError]             = useState("");
  const [resendTimer, setResendTimer] = useState(0);

  // Countdown timer for resend button
  useEffect(() => {
    if (resendTimer > 0) {
      const t = setTimeout(() => setResendTimer(r => r - 1), 1000);
      return () => clearTimeout(t);
    }
  }, [resendTimer]);

  // ── Step 1: Send OTP via Supabase Email ─────────────────────
  const sendOtp = async () => {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Enter a valid email address");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { error: otpErr } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: { shouldCreateUser: true },
      });
      if (otpErr) throw otpErr;
      setEmail(trimmed);
      setStep("otp");
      setResendTimer(30);
    } catch (e) {
      setError("Could not send OTP: " + (e?.message || "unknown error"));
    }
    setLoading(false);
  };

  // ── Step 2: Verify OTP via Supabase ─────────────────────────
  const verifyOtp = async () => {
    if (otp.length !== 6)        { setError("Enter the 6-digit OTP"); return; }
    if (!/^\d{6}$/.test(otp))    { setError("OTP must be 6 digits");  return; }
    setLoading(true);
    setError("");
    try {
      const { error: verifyErr } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type:  "email",
      });
      if (verifyErr) throw verifyErr;

      // ── Check admin ──────────────────────────────────────────
      try {
        const { data: adminRow } = await supabase
          .from("admin_phones").select("*")
          .eq("email", email).eq("is_active", true).maybeSingle();
        if (adminRow) {
          onLogin({ type: "admin", email, name: adminRow.name, role: adminRow.role });
          return;
        }
      } catch (_) {}

      // ── Check existing owner ─────────────────────────────────
      const { data: existingOwner, error: ownerErr } = await supabase
        .from("owners").select("*").eq("email", email).maybeSingle();
      if (ownerErr) { setError("Owner lookup error: " + ownerErr.message); setLoading(false); return; }
      if (existingOwner) { onLogin({ type: "owner", ...existingOwner }); return; }

      // ── Check existing tenant ────────────────────────────────
      const { data: existingTenant } = await supabase
        .from("tenants")
        .select("*, units(*, properties(*))")
        .eq("email", email)
        .eq("is_active", true)
        .maybeSingle();
      if (existingTenant) { onLogin({ type: "tenant", ...existingTenant }); return; }

      // ── New user — pick role ─────────────────────────────────
      setStep("role");
    } catch (e) {
      setError("Incorrect or expired OTP. Please try again.");
    }
    setLoading(false);
  };

  // ── Step 3: Create profile ───────────────────────────────────
  const createProfile = async () => {
    if (!name.trim()) { setError("Please enter your name"); return; }
    setLoading(true);
    setError("");
    try {
      if (role === "owner") {
        const { data: owner, error: insertErr } = await supabase
          .from("owners")
          .insert({
            email:     email,
            phone:     phone.trim() ? `+91${phone.trim().replace(/\D/g, "").slice(0, 10)}` : null,
            name:      name.trim(),
            city,
            beta_user: true,
          })
          .select("*").single();
        if (insertErr) throw insertErr;
        onLogin({ type: "owner", ...owner });
      } else {
        const { data: tenant, error: insertErr } = await supabase
          .from("tenants")
          .insert({
            email:     email,
            phone:     phone.trim() ? `+91${phone.trim().replace(/\D/g, "").slice(0, 10)}` : null,
            name:      name.trim(),
            is_active: true,
            owner_id:  null,
          })
          .select("*").single();
        if (insertErr) throw insertErr;
        onLogin({ type: "tenant", ...tenant });
      }
    } catch (e) {
      setError("Could not create profile. Please try again.");
    }
    setLoading(false);
  };

  // ── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Nunito','Segoe UI',sans-serif",
      background: T.bg,
      minHeight:  "100vh",
      display:    "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    }}>
      <style>{CSS}</style>
      <div className="fu" style={{ width: "100%", maxWidth: 400 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20,
            background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 32, margin: "0 auto 12px",
            boxShadow: `0 8px 24px ${T.saffron}35`,
          }}>🔑</div>
          <div style={{ fontSize: 26, fontWeight: 900, color: T.ink, letterSpacing: -.8 }}>RentAI</div>
          <div style={{ fontSize: 13, color: T.muted, marginTop: 4 }}>AI-powered Rent Management</div>
        </div>

        <div style={{
          background: T.surface, borderRadius: 20, padding: 28,
          border: `1.5px solid ${T.border}`,
          boxShadow: "0 4px 24px rgba(0,0,0,.06)",
        }}>

          {/* ── STEP: EMAIL ── */}
          {step === "phone" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.ink, marginBottom: 6 }}>
                Welcome to RentAI 👋
              </div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
                Enter your email — we'll send a 6-digit OTP to sign you in.
              </div>

              <div style={{
                fontSize: 11, fontWeight: 700, color: T.muted,
                letterSpacing: .5, textTransform: "uppercase", marginBottom: 8,
              }}>Email Address</div>

              <input
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && sendOtp()}
                placeholder="you@example.com"
                disabled={loading}
                style={{
                  width: "100%", background: T.panel,
                  border: `1.5px solid ${error ? T.rose : T.border2}`,
                  color: T.ink, borderRadius: 12,
                  padding: "12px 14px", fontSize: 15,
                  fontWeight: 600, boxSizing: "border-box",
                }}
              />

              {error && (
                <div style={{ color: T.rose, fontSize: 12, marginTop: 8, fontWeight: 600 }}>{error}</div>
              )}

              <button
                onClick={sendOtp}
                disabled={loading}
                style={{
                  width: "100%", marginTop: 20, padding: 14,
                  background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800,
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, cursor: "pointer",
                }}
              >
                {loading ? <Spinner /> : "Send OTP →"}
              </button>

              {/* Beta notice */}
              <div style={{
                marginTop: 20, padding: 14,
                background: T.tealL, border: `1.5px solid ${T.teal}30`,
                borderRadius: 12, fontSize: 12, color: T.teal, fontWeight: 600,
                lineHeight: 1.6,
              }}>
                🚀 <strong>Beta access:</strong> Email OTP is live! Phone / WhatsApp login coming soon.
              </div>

              <div style={{ textAlign: "center", marginTop: 16, fontSize: 12, color: T.muted }}>
                New to RentAI?{" "}
                <a
                  href="https://docs.google.com/forms/d/e/1FAIpQLScd2tgV61wlCkJMfnQSOMa0ExM-c0ZpJVU1xOd6XD63Fs6pQA/viewform"
                  target="_blank" rel="noreferrer"
                  style={{ color: T.saffron, fontWeight: 700, textDecoration: "none" }}
                >
                  Request beta access →
                </a>
              </div>
            </>
          )}

          {/* ── STEP: OTP ── */}
          {step === "otp" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.ink, marginBottom: 6 }}>
                Check your inbox 📬
              </div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
                OTP sent to{" "}
                <strong style={{ color: T.ink }}>{email}</strong>
                <button
                  onClick={() => { setStep("phone"); setOtp(""); setError(""); }}
                  style={{
                    background: "none", border: "none", color: T.saffron,
                    fontWeight: 700, fontSize: 12, marginLeft: 8, cursor: "pointer",
                  }}
                >Change</button>
              </div>

              <OtpInput value={otp} onChange={v => { setOtp(v); setError(""); }} />

              <div style={{
                textAlign: "center", marginTop: 10, padding: "9px 14px",
                background: T.saffronL, border: `1px solid ${T.saffron}25`,
                borderRadius: 10, fontSize: 12, color: T.ink2, lineHeight: 1.6,
              }}>
                📧 Check your spam folder if you don't see it within a minute.
                <br />
                <span style={{ fontSize: 11, color: T.muted }}>
                  Need help? Email{" "}
                  <a
                    href="mailto:support@rentai.co.in"
                    style={{ color: T.saffron, fontWeight: 700, textDecoration: "none" }}
                  >support@rentai.co.in</a>
                </span>
              </div>

              {error && (
                <div style={{
                  color: T.rose, fontSize: 12, marginTop: 12,
                  textAlign: "center", fontWeight: 600,
                }}>{error}</div>
              )}

              <button
                onClick={verifyOtp}
                disabled={loading || otp.length < 6}
                style={{
                  width: "100%", marginTop: 20, padding: 14,
                  background: otp.length === 6
                    ? `linear-gradient(135deg,${T.saffron},${T.saffronB})`
                    : T.panel,
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800,
                  color: otp.length === 6 ? "#fff" : T.muted,
                  display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, cursor: "pointer",
                  transition: "all .2s",
                }}
              >
                {loading ? <Spinner /> : "Verify & Login →"}
              </button>

              <div style={{ textAlign: "center", marginTop: 14, fontSize: 12, color: T.muted }}>
                {resendTimer > 0
                  ? `Resend OTP in ${resendTimer}s`
                  : (
                    <button
                      onClick={() => { setOtp(""); sendOtp(); }}
                      style={{
                        background: "none", border: "none", color: T.saffron,
                        fontWeight: 700, fontSize: 12, cursor: "pointer",
                      }}
                    >Resend OTP</button>
                  )
                }
              </div>
            </>
          )}

          {/* ── STEP: ROLE ── */}
          {step === "role" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.ink, marginBottom: 6 }}>
                Welcome to RentAI! 🎉
              </div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
                Are you a property owner or a tenant?
              </div>

              <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
                {[
                  ["owner",  "🏢", "Property Owner", "Manage flats & collect rent"],
                  ["tenant", "🏠", "Tenant",         "View bills & pay rent"],
                ].map(([v, icon, label, sub]) => (
                  <button
                    key={v}
                    onClick={() => setRole(v)}
                    style={{
                      flex: 1, padding: "16px 8px", borderRadius: 14,
                      border: `2px solid ${role === v ? T.saffron : T.border2}`,
                      background: role === v ? T.saffronL : T.panel,
                      cursor: "pointer", fontFamily: "inherit",
                      textAlign: "center", transition: "all .15s",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: role === v ? T.saffron : T.ink }}>{label}</div>
                    <div style={{ fontSize: 10, color: T.muted, marginTop: 3 }}>{sub}</div>
                  </button>
                ))}
              </div>

              <button
                onClick={() => setStep("profile")}
                style={{
                  width: "100%", padding: 14,
                  background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border: "none", borderRadius: 12, fontSize: 15,
                  fontWeight: 800, color: "#fff", cursor: "pointer",
                }}
              >
                Continue as {role === "owner" ? "Owner" : "Tenant"} →
              </button>
            </>
          )}

          {/* ── STEP: PROFILE (first time) ── */}
          {step === "profile" && (
            <>
              <div style={{ fontSize: 18, fontWeight: 900, color: T.ink, marginBottom: 6 }}>
                {role === "owner" ? "Set up your account" : "Almost there!"} 🎉
              </div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 24 }}>
                Quick setup — takes 30 seconds
              </div>

              {/* Name */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: T.muted,
                  letterSpacing: .5, textTransform: "uppercase", marginBottom: 6,
                }}>Your Name *</div>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="e.g. Suresh Rao"
                  style={{
                    width: "100%", background: T.panel,
                    border: `1.5px solid ${T.border2}`, color: T.ink,
                    borderRadius: 10, padding: "11px 14px",
                    fontSize: 14, fontWeight: 600, boxSizing: "border-box",
                  }}
                />
              </div>

              {/* City — owners only */}
              {role === "owner" && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: T.muted,
                    letterSpacing: .5, textTransform: "uppercase", marginBottom: 6,
                  }}>City</div>
                  <input
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    placeholder="e.g. Bengaluru"
                    style={{
                      width: "100%", background: T.panel,
                      border: `1.5px solid ${T.border2}`, color: T.ink,
                      borderRadius: 10, padding: "11px 14px",
                      fontSize: 14, fontWeight: 600, boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {/* Phone — optional, saved for future WhatsApp/SMS */}
              <div style={{ marginBottom: 14 }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: T.muted,
                  letterSpacing: .5, textTransform: "uppercase", marginBottom: 6,
                }}>WhatsApp Number <span style={{ fontWeight: 500, textTransform: "none" }}>(optional — for future OTP)</span></div>
                <div style={{
                  display: "flex", border: `1.5px solid ${T.border2}`,
                  borderRadius: 12, overflow: "hidden", background: T.panel,
                }}>
                  <div style={{
                    padding: "12px 14px", background: T.surface,
                    borderRight: `1px solid ${T.border2}`,
                    fontSize: 14, fontWeight: 700, color: T.ink2, whiteSpace: "nowrap",
                  }}>🇮🇳 +91</div>
                  <input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="10-digit number"
                    style={{
                      flex: 1, padding: "12px 14px", background: "transparent",
                      border: "none", fontSize: 14, fontWeight: 600,
                      color: T.ink, letterSpacing: .5,
                    }}
                  />
                </div>
                <div style={{ fontSize: 10, color: T.muted, marginTop: 5, fontWeight: 600 }}>
                  📱 We'll use this when WhatsApp / SMS OTP goes live
                </div>
              </div>

              {error && (
                <div style={{ color: T.rose, fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{error}</div>
              )}

              <button
                onClick={createProfile}
                disabled={loading}
                style={{
                  width: "100%", marginTop: 8, padding: 14,
                  background: `linear-gradient(135deg,${T.saffron},${T.saffronB})`,
                  border: "none", borderRadius: 12, fontSize: 15, fontWeight: 800,
                  color: "#fff", display: "flex", alignItems: "center",
                  justifyContent: "center", gap: 8, cursor: "pointer",
                }}
              >
                {loading ? <Spinner /> : "Enter RentAI →"}
              </button>
            </>
          )}
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: T.muted }}>
          By logging in you agree to our{" "}
          <span style={{ color: T.saffron, fontWeight: 700, cursor: "pointer" }}>Terms</span>
          {" "}and{" "}
          <span style={{ color: T.saffron, fontWeight: 700, cursor: "pointer" }}>Privacy Policy</span>
        </div>
      </div>
    </div>
  );
}

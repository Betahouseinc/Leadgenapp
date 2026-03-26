function LoginScreen({ onLogin }) {
  const [step, setStep] = React.useState("email");
  const [email, setEmail] = React.useState("");
  const [otp, setOtp] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState("");

  const sendOtp = async () => {
    if (!email) {
      setError("Enter your email");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
      });

      if (error) throw error;

      setStep("otp");
    } catch (e) {
      setError("Failed to send OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (!otp) {
      setError("Enter OTP");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token: otp,
        type: "email",
      });

      if (error) throw error;

      const user = data?.user;
      if (!user) throw new Error("No user found");

      const userEmail = user.email;

      // 🔥 ROLE CHECKING (same as your existing logic)

      // Admin
      const { data: adminRow } = await supabase
        .from("admin_phones")
        .select("*")
        .eq("email", userEmail)
        .eq("is_active", true)
        .maybeSingle();

      if (adminRow) {
        onLogin({ type: "admin", email: userEmail, name: adminRow.name });
        return;
      }

      // Owner
      const { data: owner } = await supabase
        .from("owners")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      if (owner) {
        onLogin({ type: "owner", ...owner });
        return;
      }

      // Tenant
      const { data: tenant } = await supabase
        .from("tenants")
        .select("*")
        .eq("email", userEmail)
        .maybeSingle();

      if (tenant) {
        onLogin({ type: "tenant", ...tenant });
        return;
      }

      // New user → fallback
      onLogin({ type: "new", email: userEmail });

    } catch (e) {
      setError("Invalid OTP. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: "0 auto" }}>
      <h2>Login</h2>

      {step === "email" && (
        <>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <button
            onClick={sendOtp}
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              background: "#000",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            {loading ? "Sending..." : "Send OTP"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <input
            type="text"
            placeholder="Enter OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              borderRadius: 8,
              border: "1px solid #ccc",
            }}
          />

          <button
            onClick={verifyOtp}
            disabled={loading}
            style={{
              width: "100%",
              padding: 12,
              borderRadius: 8,
              background: "#000",
              color: "#fff",
              fontWeight: "bold",
            }}
          >
            {loading ? "Verifying..." : "Verify OTP"}
          </button>
        </>
      )}

      {error && (
        <p style={{ color: "red", marginTop: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}

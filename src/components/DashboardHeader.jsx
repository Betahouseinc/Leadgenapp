// ── DASHBOARD HEADER ─────────────────────────────────────────
// Shows: Welcome {name}, property name, Owner badge, logout button.

const T = {
  surface: "#FFFFFF",
  border:  "#E8E4DC",
  ink:     "#2C2416",
  ink2:    "#5C5240",
  muted:   "#9C8E7A",
  teal:    "#1A8A72",
  tealL:   "#E0F5F0",
  saffron: "#E8821A",
  saffronB:"#F5A650",
};

export default function DashboardHeader({ user, onLogout }) {
  return (
    <div style={{
      background: T.surface,
      borderBottom: `1.5px solid ${T.border}`,
      padding: "14px 16px 12px",
      position: "sticky",
      top: 0,
      zIndex: 50,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

        {/* Left: identity */}
        <div>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 1 }}>
            Welcome back,
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.ink, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {user.name} 👋
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <div style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>
              🏠 {user.property}
            </div>
            <span style={{
              fontSize: 9, fontWeight: 800, padding: "2px 8px",
              borderRadius: 20, background: T.tealL, color: T.teal,
              border: `1px solid ${T.teal}35`, letterSpacing: 0.4,
            }}>
              {(user.role || "Owner").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Right: logout */}
        <button
          onClick={onLogout}
          style={{
            background: "transparent",
            border: `1.5px solid ${T.border}`,
            borderRadius: 8,
            padding: "5px 12px",
            fontSize: 11,
            fontWeight: 700,
            color: T.muted,
            cursor: "pointer",
            marginTop: 4,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
}

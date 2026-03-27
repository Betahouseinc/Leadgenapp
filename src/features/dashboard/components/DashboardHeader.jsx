import { T } from "../../../theme";

/**
 * Sticky top bar: welcome greeting, property name, role badge, logout.
 *
 * @param {{ name: string, role: string, property: string }} user
 * @param {() => void} onLogout
 */
export default function DashboardHeader({ user, onLogout }) {
  return (
    <header
      style={{
        background: T.surface,
        borderBottom: `1.5px solid ${T.border}`,
        padding: "14px 16px 12px",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

        {/* Identity */}
        <div>
          <div style={{ fontSize: 11, color: T.muted, fontWeight: 600, marginBottom: 1 }}>
            Welcome back,
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: T.ink, letterSpacing: -0.5, lineHeight: 1.1 }}>
            {user.name} 👋
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 5 }}>
            <span style={{ fontSize: 11, color: T.ink2, fontWeight: 600 }}>
              🏠 {user.property}
            </span>
            <span
              style={{
                fontSize: 9, fontWeight: 800, padding: "2px 8px",
                borderRadius: 20, background: T.tealL, color: T.teal,
                border: `1px solid ${T.teal}35`, letterSpacing: 0.4,
              }}
            >
              {(user.role || "Owner").toUpperCase()}
            </span>
          </div>
        </div>

        {/* Logout */}
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
            marginTop: 4,
          }}
        >
          Logout
        </button>
      </div>
    </header>
  );
}

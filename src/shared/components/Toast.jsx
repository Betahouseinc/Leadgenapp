import { useTheme } from "../contexts/ThemeContext";

/**
 * Fixed-position toast notification.
 * Renders nothing when `msg` is null/empty.
 */
export default function Toast({ msg }) {
  const { T } = useTheme();
  if (!msg) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        bottom: 28,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "11px 24px",
        borderRadius: 13,
        background: `linear-gradient(135deg, ${T.saffron}, ${T.saffronB})`,
        color: "#fff",
        fontWeight: 800,
        fontSize: 13,
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
        zIndex: 9999,
        whiteSpace: "nowrap",
        boxShadow: `0 8px 28px ${T.saffron}40`,
        animation: "toastIn .25s ease",
      }}
    >
      {msg}
    </div>
  );
}

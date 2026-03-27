import { T } from "../../../theme";

const CARDS = [
  { key: "dueToday",     icon: "📅", label: "Due Today", color: T.amber,  bg: T.amberL },
  { key: "overdueCount", icon: "🚨", label: "Overdue",   color: T.rose,   bg: T.roseL  },
  { key: "pendingCount", icon: "🔔", label: "Reminders", color: T.sky,    bg: T.skyL   },
];

/**
 * Three-card grid showing today's rent summary.
 *
 * @param {number} dueToday
 * @param {number} overdueCount
 * @param {number} pendingCount
 */
export default function SummaryCards({ dueToday, overdueCount, pendingCount }) {
  const values = { dueToday, overdueCount, pendingCount };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 10,
        marginBottom: 20,
      }}
    >
      {CARDS.map(({ key, icon, label, color, bg }) => {
        const value  = values[key] ?? 0;
        const active = value > 0;

        return (
          <div
            key={key}
            style={{
              background: active ? bg : T.card,
              border: `1.5px solid ${active ? color + "35" : T.border}`,
              borderRadius: 14,
              padding: "13px 10px 11px",
              textAlign: "center",
              transition: "all .2s",
            }}
          >
            <div style={{ fontSize: 22, marginBottom: 5 }}>{icon}</div>
            <div
              style={{
                fontSize: 26, fontWeight: 900, letterSpacing: -0.8,
                color: active ? color : T.ink, lineHeight: 1,
              }}
            >
              {value}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, marginTop: 4 }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

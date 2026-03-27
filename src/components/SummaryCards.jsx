// ── TODAY SUMMARY CARDS ───────────────────────────────────────
// Three metric cards: rents due today / overdue count / pending reminders.

const T = {
  card:   "#FFFFFF",
  panel:  "#F5F3EE",
  border: "#E8E4DC",
  ink:    "#2C2416",
  muted:  "#9C8E7A",
  rose:   "#C44B4B",
  roseL:  "#FDEAEA",
  amber:  "#D4A017",
  amberL: "#FDF8E0",
  sky:    "#2D7DD2",
  skyL:   "#E8F2FC",
};

const CARDS = [
  {
    key:   "dueToday",
    icon:  "📅",
    label: "Due Today",
    color: T.amber,
    bg:    T.amberL,
  },
  {
    key:   "overdueCount",
    icon:  "🚨",
    label: "Overdue",
    color: T.rose,
    bg:    T.roseL,
  },
  {
    key:   "pendingCount",
    icon:  "🔔",
    label: "Reminders",
    color: T.sky,
    bg:    T.skyL,
  },
];

export default function SummaryCards({ dueToday, overdueCount, pendingCount }) {
  const values = { dueToday, overdueCount, pendingCount };

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 10,
      marginBottom: 20,
    }}>
      {CARDS.map(({ key, icon, label, color, bg }) => {
        const value = values[key] ?? 0;
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
            <div style={{
              fontSize: 26,
              fontWeight: 900,
              letterSpacing: -0.8,
              color: active ? color : T.ink,
              lineHeight: 1,
            }}>
              {value}
            </div>
            <div style={{
              fontSize: 10,
              fontWeight: 700,
              color: T.muted,
              marginTop: 4,
              letterSpacing: 0.2,
            }}>
              {label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

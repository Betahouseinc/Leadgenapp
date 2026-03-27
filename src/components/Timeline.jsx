// ── TIMELINE ─────────────────────────────────────────────────
// Rent history as: Date → Status badge → Amount.
// Default: current month + last month. "View older" reveals rest.

import { useState } from "react";

const T = {
  card:   "#FFFFFF",
  panel:  "#FAFAF7",
  border: "#E8E4DC",
  ink:    "#2C2416",
  ink2:   "#5C5240",
  muted:  "#9C8E7A",
  subtle: "#C4BAA8",
  green:  "#2E7D32",
  greenL: "#E8F5E9",
  amber:  "#D4A017",
  amberL: "#FDF8E0",
  saffron:"#E8821A",
  saffronL:"#FDF0E0",
  rose:   "#C44B4B",
  roseL:  "#FDEAEA",
};

const STATUS_CONFIG = {
  paid:     { label: "Paid",       color: T.green,   bg: T.greenL   },
  upcoming: { label: "Upcoming",   color: T.amber,   bg: T.amberL   },
  due:      { label: "Due Today",  color: T.saffron, bg: T.saffronL },
  overdue:  { label: "Overdue",    color: T.rose,    bg: T.roseL    },
};

const fd  = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (d) => d
  ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
  : "—";

export default function Timeline({ rents }) {
  const [showAll, setShowAll] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Cutoff = 1st of last month
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  // Sort newest first
  const sorted = [...rents].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));

  const recentRents = sorted.filter(r => new Date(r.dueDate) >= startOfLastMonth);
  const olderRents  = sorted.filter(r => new Date(r.dueDate) <  startOfLastMonth);

  const visible = showAll ? sorted : recentRents;

  return (
    <div>
      {/* Header row */}
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Rent History</div>
        <div style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>
          {showAll
            ? `${sorted.length} records total`
            : `${recentRents.length} records · last 2 months`}
        </div>
      </div>

      {/* Timeline list */}
      <div style={{
        background: T.card,
        border: `1.5px solid ${T.border}`,
        borderRadius: 16,
        overflow: "hidden",
      }}>
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>
            No records found
          </div>
        )}

        {visible.map((rent, i) => {
          const status = rent.derivedStatus || "upcoming";
          const cfg    = STATUS_CONFIG[status] || STATUS_CONFIG.upcoming;
          const isLast = i === visible.length - 1;

          return (
            <div
              key={rent.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "11px 14px",
                borderBottom: isLast ? "none" : `1px solid ${T.border}`,
                background: i % 2 === 0 ? T.card : T.panel,
              }}
            >
              {/* Date column */}
              <div style={{ minWidth: 64 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.ink }}>
                  {fmt(rent.dueDate)}
                </div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>
                  {rent.unit}
                </div>
              </div>

              {/* Dot connector */}
              <div style={{
                width: 7, height: 7,
                borderRadius: "50%",
                background: cfg.color,
                flexShrink: 0,
                boxShadow: `0 0 0 2px ${cfg.bg}`,
              }} />

              {/* Tenant name */}
              <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: T.ink2 }}>
                {rent.tenant}
              </div>

              {/* Status badge */}
              <span style={{
                fontSize: 9, fontWeight: 800,
                padding: "3px 9px", borderRadius: 20,
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.color}25`,
                whiteSpace: "nowrap",
              }}>
                {cfg.label}
              </span>

              {/* Amount */}
              <div style={{
                fontSize: 12, fontWeight: 900,
                color: T.ink, minWidth: 56,
                textAlign: "right",
              }}>
                {fd(rent.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* View older toggle */}
      {olderRents.length > 0 && (
        <button
          onClick={() => setShowAll(v => !v)}
          style={{
            width: "100%",
            marginTop: 10,
            padding: "10px",
            background: "transparent",
            border: `1.5px solid ${T.border}`,
            borderRadius: 12,
            fontSize: 12,
            fontWeight: 700,
            color: T.muted,
            cursor: "pointer",
            letterSpacing: 0.2,
          }}
        >
          {showAll
            ? "↑ Show less"
            : `↓ View older (${olderRents.length} more records)`}
        </button>
      )}
    </div>
  );
}

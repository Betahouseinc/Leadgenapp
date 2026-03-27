// ── RENT CARD (Hero) ─────────────────────────────────────────
// Shows the most urgent unpaid rent with action buttons.
// Color-coded gradient: green=paid, yellow=upcoming, orange=due, red=overdue.

import { useState } from "react";

const STATUS_CONFIG = {
  paid:     { label: "Paid",       color: "#2E7D32", gradient: "linear-gradient(135deg, #2E7D32, #43A047)" },
  upcoming: { label: "Upcoming",   color: "#D4A017", gradient: "linear-gradient(135deg, #B8860B, #D4A017)" },
  due:      { label: "Due Today",  color: "#E8821A", gradient: "linear-gradient(135deg, #E8821A, #F5A650)" },
  overdue:  { label: "Overdue",    color: "#C44B4B", gradient: "linear-gradient(135deg, #B03030, #C44B4B)" },
};

const fd  = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");
const fmt = (d) => d
  ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
  : "—";

export default function RentCard({ rent, derivedStatus, onMarkPaid, onSendReminder }) {
  const [loading, setLoading] = useState(false);
  const cfg    = STATUS_CONFIG[derivedStatus] || STATUS_CONFIG.upcoming;
  const isPaid = derivedStatus === "paid";

  const handlePaid = async () => {
    setLoading(true);
    await onMarkPaid(rent.id);
    setLoading(false);
  };

  return (
    <div style={{
      background: cfg.gradient,
      borderRadius: 20,
      padding: "20px 20px 18px",
      marginBottom: 18,
      color: "#fff",
      position: "relative",
      overflow: "hidden",
      boxShadow: `0 8px 32px ${cfg.color}30`,
    }}>
      {/* Decorative blobs */}
      <div style={{
        position: "absolute", top: -35, right: -35,
        width: 120, height: 120, borderRadius: "50%",
        background: "rgba(255,255,255,.08)", pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", bottom: -20, left: -20,
        width: 80, height: 80, borderRadius: "50%",
        background: "rgba(255,255,255,.06)", pointerEvents: "none",
      }} />

      {/* Label */}
      <div style={{ fontSize: 10, fontWeight: 700, opacity: 0.8, letterSpacing: 1, marginBottom: 6 }}>
        NEXT RENT DUE
      </div>

      {/* Amount + Status badge */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
        <div style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1.5, lineHeight: 1 }}>
          {fd(rent.amount)}
        </div>
        <span style={{
          fontSize: 11, fontWeight: 800, padding: "5px 13px",
          background: "rgba(255,255,255,.22)",
          border: "1px solid rgba(255,255,255,.35)",
          borderRadius: 20, backdropFilter: "blur(4px)",
          marginTop: 4,
        }}>
          {cfg.label}
        </span>
      </div>

      {/* Tenant + unit */}
      <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.92, marginBottom: 2 }}>
        {rent.tenant} · {rent.unit}
      </div>

      {/* Dates */}
      <div style={{ fontSize: 11, opacity: 0.78, marginBottom: 18 }}>
        Due: {fmt(rent.dueDate)}
        {isPaid && rent.paidDate && ` · Paid: ${fmt(rent.paidDate)}`}
      </div>

      {/* Actions */}
      {isPaid ? (
        <div style={{
          padding: "10px 16px",
          background: "rgba(255,255,255,.18)",
          borderRadius: 12, fontSize: 13, fontWeight: 700,
          textAlign: "center",
          border: "1.5px solid rgba(255,255,255,.3)",
        }}>
          ✅ Payment received
        </div>
      ) : (
        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => onSendReminder(rent)}
            style={{
              flex: 1, padding: "11px 0",
              background: "rgba(255,255,255,.18)",
              border: "1.5px solid rgba(255,255,255,.35)",
              borderRadius: 12, fontSize: 12, fontWeight: 800,
              color: "#fff", cursor: "pointer",
              backdropFilter: "blur(4px)",
              letterSpacing: 0.2,
            }}
          >
            📱 Send Reminder
          </button>
          <button
            onClick={handlePaid}
            disabled={loading}
            style={{
              flex: 1, padding: "11px 0",
              background: "rgba(255,255,255,.92)",
              border: "none",
              borderRadius: 12, fontSize: 12, fontWeight: 800,
              color: cfg.color, cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.75 : 1,
              letterSpacing: 0.2,
              transition: "opacity .15s",
            }}
          >
            {loading ? "Saving…" : "✓ Mark as Paid"}
          </button>
        </div>
      )}
    </div>
  );
}

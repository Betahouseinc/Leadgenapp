import { useState } from "react";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { fd } from "../../../utils/currency";
import { fmtShort } from "../../../utils/date";

/**
 * Rent history timeline: Date → status dot → Tenant → Status badge → Amount.
 * Default view: current month + last month. "View older" reveals the rest.
 *
 * @param {Array} rents - Rent records with `derivedStatus` attached.
 */
export default function Timeline({ rents }) {
  const { T, STATUS_CONFIG } = useTheme();
  const [showAll, setShowAll] = useState(false);

  const today          = new Date();
  today.setHours(0, 0, 0, 0);
  const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const sorted      = [...rents].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate));
  const recentRents = sorted.filter((r) => new Date(r.dueDate) >= startOfLastMonth);
  const olderRents  = sorted.filter((r) => new Date(r.dueDate) <  startOfLastMonth);
  const visible     = showAll ? sorted : recentRents;

  return (
    <section>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <h2 style={{ fontSize: 13, fontWeight: 800, color: T.ink }}>Rent History</h2>
        <span style={{ fontSize: 10, color: T.muted, fontWeight: 600 }}>
          {showAll
            ? `${sorted.length} records total`
            : `${recentRents.length} records · last 2 months`}
        </span>
      </div>

      {/* List */}
      <div
        style={{
          background: T.card,
          border: `1.5px solid ${T.border}`,
          borderRadius: 16,
          overflow: "hidden",
        }}
      >
        {visible.length === 0 && (
          <div style={{ padding: 24, textAlign: "center", color: T.muted, fontSize: 13 }}>
            No records found
          </div>
        )}

        {visible.map((rent, i) => {
          const cfg    = STATUS_CONFIG[rent.derivedStatus] ?? STATUS_CONFIG.upcoming;
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
              {/* Date + unit */}
              <div style={{ minWidth: 64 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: T.ink }}>
                  {fmtShort(rent.dueDate)}
                </div>
                <div style={{ fontSize: 9, color: T.muted, marginTop: 1 }}>{rent.unit}</div>
              </div>

              {/* Status dot */}
              <div
                style={{
                  width: 7, height: 7, borderRadius: "50%",
                  background: cfg.color, flexShrink: 0,
                  boxShadow: `0 0 0 2px ${cfg.bg}`,
                }}
              />

              {/* Tenant */}
              <div style={{ flex: 1, fontSize: 11, fontWeight: 700, color: T.ink2 }}>
                {rent.tenant}
              </div>

              {/* Status badge */}
              <span
                style={{
                  fontSize: 9, fontWeight: 800,
                  padding: "3px 9px", borderRadius: 20,
                  background: cfg.bg, color: cfg.color,
                  border: `1px solid ${cfg.color}25`,
                  whiteSpace: "nowrap",
                }}
              >
                {cfg.label}
              </span>

              {/* Amount */}
              <div style={{ fontSize: 12, fontWeight: 900, color: T.ink, minWidth: 56, textAlign: "right" }}>
                {fd(rent.amount)}
              </div>
            </div>
          );
        })}
      </div>

      {/* View older toggle */}
      {olderRents.length > 0 && (
        <button
          onClick={() => setShowAll((v) => !v)}
          style={{
            width: "100%", marginTop: 10, padding: "10px",
            background: "transparent", border: `1.5px solid ${T.border}`,
            borderRadius: 12, fontSize: 12, fontWeight: 700, color: T.muted,
          }}
        >
          {showAll ? "↑ Show less" : `↓ View older (${olderRents.length} more records)`}
        </button>
      )}
    </section>
  );
}

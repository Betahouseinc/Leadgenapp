import { useMemo } from "react";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { generateInsights } from "../../../utils/insights";

/**
 * SmartInsights — rule-based insight cards for the Owner Dashboard.
 *
 * Props
 * ─────
 * @param {Array} rentsWithStatus  – from useDashboard()
 * @param {Array} expenses         – [{ amount, date }] — pass [] until wired to Supabase
 * @param {Array} units            – [{ id, name, lease_end, tenant_name, is_occupied }]
 *
 * Real integration note
 * ──────────────────────
 * In useDashboard.js, add:
 *   const { data: expenses } = await supabase.from("expenses").select("*").eq("owner_id", ownerId);
 *   const { data: units }    = await supabase.from("units").select("*, tenants(name)").eq("owner_id", ownerId);
 * Then pass them down as props.
 */
export default function SmartInsights({ rentsWithStatus = [], expenses = [], units = [] }) {
  const { T } = useTheme();

  const insights = useMemo(
    () => generateInsights({ rentsWithStatus, expenses, units }),
    [rentsWithStatus, expenses, units]
  );

  if (insights.length === 0) return null;

  const TYPE_STYLE = {
    warning: { bg: "#FFF1F1", border: "#FF4D4D", dot: "#FF4D4D", textColor: "#7A0000" },
    risk:    { bg: "#FFF8E6", border: "#F59E0B", dot: "#F59E0B", textColor: "#7A4500" },
    info:    { bg: "#EFF6FF", border: "#3B82F6", dot: "#3B82F6", textColor: "#1E3A5F" },
    success: { bg: "#F0FDF4", border: "#22C55E", dot: "#22C55E", textColor: "#14532D" },
  };

  return (
    <div
      style={{
        background:   T.card,
        border:       `1.5px solid ${T.border}`,
        borderRadius: 16,
        marginBottom: 20,
        overflow:     "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display:        "flex",
          alignItems:     "center",
          gap:            8,
          padding:        "13px 16px 11px",
          borderBottom:   `1px solid ${T.border}`,
          background:     T.panel,
        }}
      >
        <span style={{ fontSize: 16 }}>🧠</span>
        <span style={{ fontSize: 12, fontWeight: 900, color: T.ink, letterSpacing: 0.3 }}>
          Smart Insights
        </span>
        <span
          style={{
            marginLeft:   "auto",
            fontSize:     10, fontWeight: 800,
            background:   T.saffronL,
            color:        T.saffron,
            padding:      "2px 8px", borderRadius: 20,
            border:       `1px solid ${T.saffron}30`,
          }}
        >
          {insights.length} insight{insights.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Insight list */}
      <div style={{ padding: "10px 12px 12px" }}>
        {insights.map((ins, i) => {
          const s = TYPE_STYLE[ins.type] || TYPE_STYLE.info;
          return (
            <div
              key={i}
              style={{
                display:      "flex",
                alignItems:   "flex-start",
                gap:          10,
                padding:      "10px 12px",
                borderRadius: 12,
                background:   s.bg,
                border:       `1px solid ${s.border}25`,
                marginBottom: i < insights.length - 1 ? 8 : 0,
              }}
            >
              {/* Icon */}
              <span style={{ fontSize: 15, flexShrink: 0, marginTop: 1 }}>{ins.icon}</span>

              {/* Text */}
              <span
                style={{
                  fontSize:   13,
                  fontWeight: 600,
                  color:      s.textColor,
                  lineHeight: 1.5,
                }}
              >
                {ins.text}
              </span>

              {/* Type dot */}
              <span
                style={{
                  marginLeft:   "auto",
                  flexShrink:   0,
                  width:        7, height: 7,
                  borderRadius: "50%",
                  background:   s.dot,
                  marginTop:    5,
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

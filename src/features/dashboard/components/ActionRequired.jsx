import { useMemo } from "react";
import { useTheme } from "../../../shared/contexts/ThemeContext";
import { fd } from "../../../utils/currency";

/**
 * ActionRequired — banner shown at the top of the dashboard when there
 * are overdue or due-today rent payments that need attention.
 *
 * Props
 * ─────
 * @param {Array}    rentsWithStatus  – rent records with derivedStatus attached
 * @param {Function} onSendReminder   – (rent, ownerName) → opens WhatsApp
 * @param {string}   ownerName        – used in WhatsApp message
 *
 * Real-integration note
 * ──────────────────────
 * Replace `rentsWithStatus` with a live Supabase query:
 *   const { data } = await supabase
 *     .from("rents")
 *     .select("*")
 *     .eq("owner_id", user.id)
 *     .in("status", ["pending"]);
 * Then pass through getStatus() to derive overdue / due.
 */
export default function ActionRequired({ rentsWithStatus = [], onSendReminder, ownerName = "Owner" }) {
  const { T } = useTheme();

  // ── Compute urgency buckets ──────────────────────────────────────────────
  const { overdue, dueToday, urgencyRents, totalAmount, isOverdue, isDueToday } = useMemo(() => {
    const overdue   = rentsWithStatus.filter((r) => r.derivedStatus === "overdue");
    const dueToday  = rentsWithStatus.filter((r) => r.derivedStatus === "due");
    const urgency   = [...overdue, ...dueToday];               // combined action list
    const total     = urgency.reduce((sum, r) => sum + r.amount, 0);
    return {
      overdue,
      dueToday,
      urgencyRents: urgency,
      totalAmount:  total,
      isOverdue:    overdue.length > 0,
      isDueToday:   dueToday.length > 0,
    };
  }, [rentsWithStatus]);

  // Nothing urgent? Don't render
  if (urgencyRents.length === 0) return null;

  // ── Urgency config (red = overdue, amber = due today) ───────────────────
  const cfg = isOverdue
    ? {
        bg:       "#FFF1F1",
        border:   "#FF4D4D",
        iconBg:   "#FF4D4D",
        icon:     "🚨",
        tag:      overdue.length > 1 ? `${overdue.length} OVERDUE` : "OVERDUE",
        tagBg:    "#FF4D4D",
        tagColor: "#fff",
        label:    overdue.length === 1
          ? `${overdue[0].tenant}'s rent is overdue`
          : `${overdue.length} rent payments are overdue`,
        sub: dueToday.length > 0
          ? `+ ${dueToday.length} due today`
          : "Collect now to avoid further delays",
      }
    : {
        bg:       "#FFFBEB",
        border:   "#F59E0B",
        iconBg:   "#F59E0B",
        icon:     "⏰",
        tag:      "DUE TODAY",
        tagBg:    "#F59E0B",
        tagColor: "#fff",
        label:    dueToday.length === 1
          ? `${dueToday[0].tenant}'s rent is due today`
          : `${dueToday.length} rent payments are due today`,
        sub:      "Send a reminder or collect via UPI",
      };

  // ── UPI deep-link for quick collection (most urgent rent) ────────────────
  const topRent = urgencyRents[0];
  const handleUPI = () => {
    // Real integration: replace pa= with your registered UPI VPA
    // Amount prefills to total pending; tenant name in note.
    const upiUrl =
      `upi://pay?pa=rentai@upi&pn=RentAI` +
      `&am=${totalAmount}&cu=INR` +
      `&tn=${encodeURIComponent(`Rent from ${topRent.tenant} – ${topRent.unit}`)}`;
    window.open(upiUrl, "_blank");
  };

  const handleRemindAll = () => {
    // Send reminder for the most-urgent rent; extend to loop all if desired
    if (onSendReminder) onSendReminder(topRent, ownerName);
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        background:   cfg.bg,
        border:       `1.5px solid ${cfg.border}`,
        borderRadius: 16,
        padding:      "14px 16px",
        marginBottom: 16,
        position:     "relative",
        overflow:     "hidden",
      }}
    >
      {/* Accent left bar */}
      <div
        style={{
          position:     "absolute",
          left:         0, top: 0, bottom: 0,
          width:        4,
          background:   cfg.border,
          borderRadius: "16px 0 0 16px",
        }}
      />

      {/* Top row: icon + text + tag */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, paddingLeft: 8 }}>
        {/* Icon bubble */}
        <div
          style={{
            width:        38, height: 38, borderRadius: 12,
            background:   cfg.iconBg,
            display:      "flex", alignItems: "center", justifyContent: "center",
            fontSize:     18, flexShrink: 0,
          }}
        >
          {cfg.icon}
        </div>

        {/* Text block */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Urgency tag */}
          <span
            style={{
              display:      "inline-block",
              background:   cfg.tagBg,
              color:        cfg.tagColor,
              fontSize:     9, fontWeight: 900,
              letterSpacing: 1,
              padding:      "2px 8px", borderRadius: 20,
              marginBottom: 5,
            }}
          >
            {cfg.tag}
          </span>

          {/* Main message */}
          <div
            style={{
              fontSize:   15, fontWeight: 800,
              color:      "#111",
              lineHeight: 1.3, marginBottom: 2,
            }}
          >
            {cfg.label}
          </div>

          {/* Amount pill */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span
              style={{
                fontSize:  17, fontWeight: 900,
                color:     isOverdue ? "#CC0000" : "#B45309",
                letterSpacing: -0.5,
              }}
            >
              {fd(totalAmount)}
            </span>
            <span style={{ fontSize: 12, color: "#888", fontWeight: 600 }}>
              {urgencyRents.length > 1 ? `across ${urgencyRents.length} tenants` : `· ${topRent.unit}`}
            </span>
          </div>

          {/* Sub-label */}
          <div style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>{cfg.sub}</div>
        </div>
      </div>

      {/* ── Action buttons ───────────────────────────────────────────────── */}
      <div
        style={{
          display:       "flex",
          gap:           8,
          marginTop:     14,
          paddingLeft:   8,
          flexWrap:      "wrap",
        }}
      >
        {/* Send Reminder (WhatsApp) */}
        <button
          onClick={handleRemindAll}
          style={{
            flex:         "1 1 auto",
            padding:      "10px 0",
            borderRadius: 12,
            border:       `1.5px solid ${cfg.border}`,
            background:   "transparent",
            color:        isOverdue ? "#CC0000" : "#92400E",
            fontSize:     13, fontWeight: 800,
            cursor:       "pointer",
            display:      "flex", alignItems: "center", justifyContent: "center", gap: 6,
            transition:   "background .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isOverdue ? "#FFE4E4" : "#FEF3C7")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
        >
          💬 Send Reminder
        </button>

        {/* Collect via UPI */}
        <button
          onClick={handleUPI}
          style={{
            flex:         "1 1 auto",
            padding:      "10px 0",
            borderRadius: 12,
            border:       "none",
            background:   isOverdue ? "#FF4D4D" : "#F59E0B",
            color:        "#fff",
            fontSize:     13, fontWeight: 800,
            cursor:       "pointer",
            display:      "flex", alignItems: "center", justifyContent: "center", gap: 6,
            boxShadow:    isOverdue ? "0 2px 8px #FF4D4D55" : "0 2px 8px #F59E0B55",
            transition:   "opacity .15s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
        >
          ₹ Collect via UPI
        </button>
      </div>
    </div>
  );
}

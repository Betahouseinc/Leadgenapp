// ── DASHBOARD PAGE (/dashboard) ──────────────────────────────
// Action-first, mobile-first redesign of the OwnerDashboard.
// Uses mock data — does NOT touch the real Supabase session.
//
// Components:
//   DashboardHeader  → Welcome, property, role badge
//   RentCard         → Hero card: next rent due + actions
//   SummaryCards     → Today's summary (due / overdue / pending)
//   Timeline         → Rent history: Date → Status → Amount

import { useState } from "react";
import { mockUser, mockRents } from "../mockData";
import DashboardHeader from "../components/DashboardHeader";
import RentCard        from "../components/RentCard";
import SummaryCards    from "../components/SummaryCards";
import Timeline        from "../components/Timeline";

// ── Shared theme ──────────────────────────────────────────────
const T = {
  bg:      "#FAFAF7",
  ink:     "#2C2416",
  muted:   "#9C8E7A",
  saffron: "#E8821A",
  saffronB:"#F5A650",
};

// ── Global CSS (Nunito font + resets) ─────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;500;600;700;800;900&display=swap');
  * { box-sizing: border-box; margin: 0; padding: 0; }
  button { cursor: pointer; font-family: inherit; }
  @keyframes toastIn {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to   { opacity: 1; transform: translateX(-50%) translateY(0); }
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .fu { animation: fadeUp .35s ease both; }
`;

// ── Helpers ───────────────────────────────────────────────────
const fd = (n) => "₹" + Number(n || 0).toLocaleString("en-IN");

/** Derive display status from a rent record. */
function getStatus(rent) {
  if (rent.status === "paid") return "paid";
  const due   = new Date(rent.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() === today.getTime()) return "due";
  if (due < today) return "overdue";
  return "upcoming";
}

/** Priority order for sorting the hero card (lowest = most urgent). */
const URGENCY = { overdue: 0, due: 1, upcoming: 2, paid: 3 };

// ── Toast notification ────────────────────────────────────────
function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div style={{
      position: "fixed", bottom: 28, left: "50%",
      transform: "translateX(-50%)",
      padding: "11px 24px", borderRadius: 13,
      background: `linear-gradient(135deg, ${T.saffron}, ${T.saffronB})`,
      color: "#fff", fontWeight: 800, fontSize: 13,
      zIndex: 9999, whiteSpace: "nowrap",
      boxShadow: `0 8px 28px ${T.saffron}40`,
      animation: "toastIn .25s ease",
    }}>
      {msg}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────
export default function Dashboard() {
  const [rents, setRents] = useState(mockRents);
  const [toast, setToast] = useState(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Attach derivedStatus to every rent (drives all color logic)
  const rentsWithStatus = rents.map(r => ({
    ...r,
    derivedStatus: getStatus(r),
  }));

  // ── Hero rent: most urgent unpaid, fallback to most recent paid ──
  const unpaid = rentsWithStatus.filter(r => r.derivedStatus !== "paid");
  const heroRent = unpaid.length > 0
    ? unpaid.sort((a, b) => {
        const up = URGENCY[a.derivedStatus] - URGENCY[b.derivedStatus];
        return up !== 0 ? up : new Date(a.dueDate) - new Date(b.dueDate);
      })[0]
    : [...rentsWithStatus].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))[0];

  // ── Today summary counts ──────────────────────────────────────
  const dueToday    = rentsWithStatus.filter(r => r.derivedStatus === "due").length;
  const overdueCount = rentsWithStatus.filter(r => r.derivedStatus === "overdue").length;
  const pendingCount = rentsWithStatus.filter(r => r.derivedStatus !== "paid").length;

  // ── Actions ───────────────────────────────────────────────────
  const markPaid = (id) => {
    setRents(prev => prev.map(r =>
      r.id === id
        ? { ...r, status: "paid", paidDate: new Date().toISOString().split("T")[0] }
        : r
    ));
    showToast("Marked as paid ✓");
  };

  const sendReminder = (rent) => {
    const firstName = rent.tenant.split(" ")[0];
    const msg = `Hi ${firstName}, your rent of ${fd(rent.amount)} for unit ${rent.unit} is due. Please pay at your earliest. — ${mockUser.name} via RentAI`;
    window.open(`https://wa.me/${rent.phone}?text=${encodeURIComponent(msg)}`, "_blank");
    showToast("WhatsApp reminder opened 📱");
  };

  const handleLogout = () => {
    showToast("Logout clicked (mock mode)");
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      fontFamily: "'Nunito', 'Segoe UI', sans-serif",
      background: T.bg,
      color: T.ink,
      minHeight: "100vh",
      display: "flex",
      flexDirection: "column",
      maxWidth: 520,
      margin: "0 auto",
    }}>
      <style>{CSS}</style>

      {/* Sticky header */}
      <DashboardHeader user={mockUser} onLogout={handleLogout} />

      {/* Scrollable body */}
      <div className="fu" style={{ flex: 1, padding: "18px 16px 48px", overflowY: "auto" }}>

        {/* Section label */}
        <div style={{
          fontSize: 10, fontWeight: 800, color: T.muted,
          letterSpacing: 0.8, marginBottom: 10,
        }}>
          NEXT ACTION
        </div>

        {/* Hero rent card */}
        {heroRent && (
          <RentCard
            rent={heroRent}
            derivedStatus={heroRent.derivedStatus}
            onMarkPaid={markPaid}
            onSendReminder={sendReminder}
          />
        )}

        {/* Section label */}
        <div style={{
          fontSize: 10, fontWeight: 800, color: T.muted,
          letterSpacing: 0.8, marginBottom: 10,
        }}>
          TODAY'S SUMMARY
        </div>

        {/* Summary cards */}
        <SummaryCards
          dueToday={dueToday}
          overdueCount={overdueCount}
          pendingCount={pendingCount}
        />

        {/* Timeline */}
        <Timeline rents={rentsWithStatus} />
      </div>

      <Toast msg={toast} />
    </div>
  );
}

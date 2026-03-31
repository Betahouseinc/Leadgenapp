import { GLOBAL_CSS } from "../../theme";
import { mockUser } from "../../data/mockData";
import { useDashboard } from "./hooks/useDashboard";
import { ThemeProvider, useTheme } from "../../shared/contexts/ThemeContext";
import DashboardHeader from "./components/DashboardHeader";
import RentCard        from "./components/RentCard";
import SummaryCards    from "./components/SummaryCards";
import Timeline        from "./components/Timeline";
import Toast           from "../../shared/components/Toast";

const SectionLabel = ({ children }) => {
  const { T } = useTheme();
  return (
    <div style={{ fontSize: 10, fontWeight: 800, color: T.muted, letterSpacing: 0.8, marginBottom: 10 }}>
      {children}
    </div>
  );
};

function DashboardInner() {
  const { T } = useTheme();
  const { rentsWithStatus, heroRent, summary, markPaid, sendReminder, toastMsg } = useDashboard();

  const handleLogout = () => {
    // TODO: wire to real auth session when connecting to Supabase
    console.info("Logout triggered");
  };

  return (
    <div
      style={{
        fontFamily: "'Nunito', 'Segoe UI', sans-serif",
        background: T.bg,
        color: T.ink,
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        maxWidth: 520,
        margin: "0 auto",
      }}
    >
      <style>{GLOBAL_CSS}</style>

      <DashboardHeader user={mockUser} onLogout={handleLogout} />

      <main className="fu" style={{ flex: 1, padding: "18px 16px 48px" }}>
        <SectionLabel>NEXT ACTION</SectionLabel>

        {heroRent && (
          <RentCard
            rent={heroRent}
            derivedStatus={heroRent.derivedStatus}
            onMarkPaid={markPaid}
            onSendReminder={(rent) => sendReminder(rent, mockUser.name)}
          />
        )}

        <SectionLabel>TODAY'S SUMMARY</SectionLabel>
        <SummaryCards {...summary} />

        <Timeline rents={rentsWithStatus} />
      </main>

      <Toast msg={toastMsg} />
    </div>
  );
}

/**
 * Action-first Owner Dashboard — wraps inner content with ThemeProvider.
 */
export default function Dashboard() {
  return (
    <ThemeProvider>
      <DashboardInner />
    </ThemeProvider>
  );
}

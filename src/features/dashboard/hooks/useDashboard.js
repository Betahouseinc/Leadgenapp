import { useState, useMemo } from "react";
import { mockRents } from "../../../data/mockData";
import { getStatus, getHeroRent } from "../../../utils/rentStatus";
import { useToast } from "../../../shared/hooks/useToast";
import { fd } from "../../../utils/currency";

/**
 * Encapsulates all state and business logic for the Owner Dashboard.
 * The page component stays a thin presenter with no logic of its own.
 */
export function useDashboard() {
  const [rents, setRents] = useState(mockRents);
  const { msg: toastMsg, show: showToast } = useToast();

  // Attach a live `derivedStatus` to every rent record
  const rentsWithStatus = useMemo(
    () => rents.map((r) => ({ ...r, derivedStatus: getStatus(r) })),
    [rents]
  );

  // Hero card: the single most-urgent unpaid rent
  const heroRent = useMemo(() => getHeroRent(rentsWithStatus), [rentsWithStatus]);

  // Today's summary counts
  const summary = useMemo(() => ({
    dueToday:     rentsWithStatus.filter((r) => r.derivedStatus === "due").length,
    overdueCount: rentsWithStatus.filter((r) => r.derivedStatus === "overdue").length,
    pendingCount: rentsWithStatus.filter((r) => r.derivedStatus !== "paid").length,
  }), [rentsWithStatus]);

  /** Optimistically mark a rent as paid in local state. */
  const markPaid = (id) => {
    setRents((prev) =>
      prev.map((r) =>
        r.id === id
          ? { ...r, status: "paid", paidDate: new Date().toISOString().split("T")[0] }
          : r
      )
    );
    showToast("Marked as paid ✓");
  };

  /** Open WhatsApp with a pre-filled reminder message. */
  const sendReminder = (rent, ownerName) => {
    const firstName = rent.tenant.split(" ")[0];
    const text = `Hi ${firstName}, your rent of ${fd(rent.amount)} for unit ${rent.unit} is due. Please pay at your earliest. — ${ownerName} via RentAI`;
    window.open(`https://wa.me/${rent.phone}?text=${encodeURIComponent(text)}`, "_blank");
    showToast("WhatsApp reminder opened 📱");
  };

  return { rentsWithStatus, heroRent, summary, markPaid, sendReminder, toastMsg };
}

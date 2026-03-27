/** Derive a display status from a rent record at runtime. */
export function getStatus(rent) {
  if (rent.status === "paid") return "paid";
  const due   = new Date(rent.dueDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  if (due.getTime() === today.getTime()) return "due";
  if (due < today) return "overdue";
  return "upcoming";
}

/** Priority weights for hero-card selection — lower = more urgent. */
export const URGENCY = { overdue: 0, due: 1, upcoming: 2, paid: 3 };

/**
 * Pick the single most-urgent unpaid rent from a list that already
 * has `derivedStatus` attached. Falls back to the most-recent paid
 * record when every rent has been settled.
 */
export function getHeroRent(rents) {
  const unpaid = rents.filter((r) => r.derivedStatus !== "paid");
  if (unpaid.length > 0) {
    return unpaid.sort((a, b) => {
      const byUrgency = URGENCY[a.derivedStatus] - URGENCY[b.derivedStatus];
      return byUrgency !== 0 ? byUrgency : new Date(a.dueDate) - new Date(b.dueDate);
    })[0];
  }
  return [...rents].sort((a, b) => new Date(b.dueDate) - new Date(a.dueDate))[0];
}

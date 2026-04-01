import { fd } from "./currency";

/**
 * generateInsights — pure rule-based logic, no AI API needed.
 *
 * @param {object} params
 * @param {Array}  params.rentsWithStatus  – rent records with derivedStatus attached
 * @param {Array}  params.expenses         – expense records [{ amount, date }]
 * @param {Array}  params.units            – unit records [{ id, lease_end, tenant_name }]
 *
 * Returns an array of insight objects:
 *   { type: "warning"|"success"|"info"|"risk", icon: string, text: string }
 *
 * Real integration: swap mockData with live Supabase queries in useDashboard.js
 */
export function generateInsights({ rentsWithStatus = [], expenses = [], units = [] }) {
  const insights = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // ── 1. Overdue rent ───────────────────────────────────────────────────────
  const overdue = rentsWithStatus.filter((r) => r.derivedStatus === "overdue");
  overdue.forEach((r) => {
    const daysLate = Math.floor((today - new Date(r.dueDate)) / 86400000);
    insights.push({
      type: "warning",
      icon: "🚨",
      text: `${r.tenant} hasn't paid ${fd(r.amount)} — ${daysLate} day${daysLate !== 1 ? "s" : ""} overdue (Unit ${r.unit})`,
    });
  });

  // ── 2. Due today ──────────────────────────────────────────────────────────
  const dueToday = rentsWithStatus.filter((r) => r.derivedStatus === "due");
  dueToday.forEach((r) => {
    insights.push({
      type: "info",
      icon: "⏰",
      text: `${r.tenant}'s rent of ${fd(r.amount)} is due today (Unit ${r.unit})`,
    });
  });

  // ── 3. Expense health ─────────────────────────────────────────────────────
  const currentMonth = today.getMonth();
  const currentYear  = today.getFullYear();

  const monthlyExpenses = expenses.filter((e) => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalExpenses = monthlyExpenses.reduce((s, e) => s + (e.amount || 0), 0);

  const paidThisMonth = rentsWithStatus
    .filter((r) => r.status === "paid" && r.paidDate && (() => {
      const d = new Date(r.paidDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    })())
    .reduce((s, r) => s + r.amount, 0);

  if (totalExpenses === 0) {
    insights.push({
      type: "success",
      icon: "✅",
      text: "Great job — no expenses logged this month, keeping costs lean.",
    });
  } else if (paidThisMonth > 0) {
    const expenseRatio = totalExpenses / paidThisMonth;
    if (expenseRatio > 0.5) {
      insights.push({
        type: "warning",
        icon: "⚠️",
        text: `Expenses are ${Math.round(expenseRatio * 100)}% of income this month (${fd(totalExpenses)} spent vs ${fd(paidThisMonth)} collected). Review costs.`,
      });
    } else if (expenseRatio > 0.3) {
      insights.push({
        type: "info",
        icon: "📊",
        text: `Expenses are ${Math.round(expenseRatio * 100)}% of income this month. Keep an eye on costs.`,
      });
    } else {
      insights.push({
        type: "success",
        icon: "✅",
        text: `Expenses are only ${Math.round(expenseRatio * 100)}% of income — healthy margin this month.`,
      });
    }
  }

  // ── 4. Lease ending soon ─────────────────────────────────────────────────
  units.forEach((u) => {
    if (!u.lease_end) return;
    const leaseEnd = new Date(u.lease_end);
    leaseEnd.setHours(0, 0, 0, 0);
    const daysLeft = Math.floor((leaseEnd - today) / 86400000);

    if (daysLeft < 0) {
      insights.push({
        type: "risk",
        icon: "🏚️",
        text: `${u.tenant_name || "A tenant"}'s lease expired ${Math.abs(daysLeft)} days ago — Unit ${u.name || u.id}. Renew or relist.`,
      });
    } else if (daysLeft <= 30) {
      insights.push({
        type: "risk",
        icon: "📋",
        text: `${u.tenant_name || "A tenant"}'s lease ends in ${daysLeft} day${daysLeft !== 1 ? "s" : ""} — Unit ${u.name || u.id}. Risk of vacancy.`,
      });
    } else if (daysLeft <= 60) {
      insights.push({
        type: "info",
        icon: "📅",
        text: `${u.tenant_name || "A tenant"}'s lease ends in ${daysLeft} days — Unit ${u.name || u.id}. Good time to discuss renewal.`,
      });
    }
  });

  // ── 5. Projected income (next 6 months) ──────────────────────────────────
  const upcoming = rentsWithStatus.filter((r) => r.derivedStatus !== "paid");
  const uniqueTenants = [...new Set(upcoming.map((r) => r.tenant))];
  const avgMonthlyRent = uniqueTenants.reduce((sum, tenant) => {
    const tenantRent = rentsWithStatus.find((r) => r.tenant === tenant);
    return sum + (tenantRent?.amount || 0);
  }, 0);

  if (avgMonthlyRent > 0) {
    insights.push({
      type: "info",
      icon: "📈",
      text: `Projected rental income over next 6 months: ${fd(avgMonthlyRent * 6)} (${uniqueTenants.length} active tenant${uniqueTenants.length !== 1 ? "s" : ""})`,
    });
  }

  // ── 6. All rent collected ─────────────────────────────────────────────────
  const allPaid = rentsWithStatus.length > 0 &&
    rentsWithStatus.filter((r) => {
      const d = new Date(r.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    }).every((r) => r.derivedStatus === "paid");

  if (allPaid) {
    insights.push({
      type: "success",
      icon: "🎉",
      text: "All rents collected this month — great collection rate!",
    });
  }

  // ── 7. No units / vacant ─────────────────────────────────────────────────
  const vacantUnits = units.filter((u) => !u.tenant_name && !u.is_occupied);
  if (vacantUnits.length > 0) {
    insights.push({
      type: "risk",
      icon: "🏠",
      text: `${vacantUnits.length} unit${vacantUnits.length !== 1 ? "s are" : " is"} currently vacant — potential lost income.`,
    });
  }

  return insights;
}

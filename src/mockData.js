// ── MOCK DATA LAYER ────────────────────────────────────────────
// Used by the /dashboard preview route.
// Dates are relative to 2026-03-28 (today during design).

export const mockUser = {
  name: "Rajesh Sharma",
  role: "Owner",
  property: "Sharma Residency, Bengaluru",
};

export const mockProperties = [
  { id: 1, name: "Sharma Residency", city: "Bengaluru", units: 6 },
];

// status: "pending" → derive overdue/due/upcoming at runtime; "paid" → done
export const mockRents = [
  // ── January 2026 ─────────────────────────────────────────────
  { id: 101, tenant: "Priya Mehta",  unit: "A-101", phone: "919876543210", amount: 15000, dueDate: "2026-01-01", status: "paid", paidDate: "2026-01-03" },
  { id: 102, tenant: "Amit Kumar",   unit: "B-202", phone: "919123456789", amount: 12000, dueDate: "2026-01-01", status: "paid", paidDate: "2026-01-05" },
  { id: 103, tenant: "Sunita Rao",   unit: "C-303", phone: "917654321098", amount: 10000, dueDate: "2026-01-01", status: "paid", paidDate: "2026-01-07" },
  { id: 104, tenant: "Ravi Singh",   unit: "D-404", phone: "918765432109", amount:  8000, dueDate: "2026-01-01", status: "paid", paidDate: "2026-01-10" },

  // ── February 2026 ────────────────────────────────────────────
  { id:   1, tenant: "Priya Mehta",  unit: "A-101", phone: "919876543210", amount: 15000, dueDate: "2026-02-01", status: "pending", paidDate: null },
  { id:   2, tenant: "Amit Kumar",   unit: "B-202", phone: "919123456789", amount: 12000, dueDate: "2026-02-01", status: "paid",    paidDate: "2026-02-04" },
  { id:   3, tenant: "Sunita Rao",   unit: "C-303", phone: "917654321098", amount: 10000, dueDate: "2026-02-01", status: "paid",    paidDate: "2026-02-06" },
  { id:   4, tenant: "Ravi Singh",   unit: "D-404", phone: "918765432109", amount:  8000, dueDate: "2026-02-01", status: "paid",    paidDate: "2026-02-10" },

  // ── March 2026 ───────────────────────────────────────────────
  { id:   5, tenant: "Priya Mehta",  unit: "A-101", phone: "919876543210", amount: 15000, dueDate: "2026-03-01", status: "pending", paidDate: null },
  { id:   6, tenant: "Amit Kumar",   unit: "B-202", phone: "919123456789", amount: 12000, dueDate: "2026-03-01", status: "paid",    paidDate: "2026-03-03" },
  { id:   7, tenant: "Sunita Rao",   unit: "C-303", phone: "917654321098", amount: 10000, dueDate: "2026-03-15", status: "pending", paidDate: null },
  { id:   8, tenant: "Ravi Singh",   unit: "D-404", phone: "918765432109", amount:  8000, dueDate: "2026-03-28", status: "pending", paidDate: null },

  // ── April 2026 (upcoming) ────────────────────────────────────
  { id:   9, tenant: "Dev Patel",    unit: "E-505", phone: "916543210987", amount: 20000, dueDate: "2026-04-01", status: "pending", paidDate: null },
  { id:  14, tenant: "Pooja Nair",   unit: "F-606", phone: "915432109876", amount: 18000, dueDate: "2026-04-05", status: "pending", paidDate: null },
];

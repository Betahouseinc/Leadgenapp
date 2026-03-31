/** Format a date string as "1 Feb 2026" */
export const fmt = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

/** Format a date string as "1 Feb" (no year) */
export const fmtShort = (d) =>
  d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—";

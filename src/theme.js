// ── DESIGN TOKENS ─────────────────────────────────────────────
// Single source of truth for colors, status config, and global CSS.
// Matches the warm palette used throughout App.jsx.

export const T = {
  bg:       "#FAFAF7",
  surface:  "#FFFFFF",
  panel:    "#F5F3EE",
  card:     "#FFFFFF",
  border:   "#E8E4DC",
  border2:  "#D4CFC4",
  ink:      "#2C2416",
  ink2:     "#5C5240",
  muted:    "#9C8E7A",
  subtle:   "#C4BAA8",
  saffron:  "#E8821A",
  saffronL: "#FDF0E0",
  saffronB: "#F5A650",
  teal:     "#1A8A72",
  tealL:    "#E0F5F0",
  tealB:    "#2AB394",
  amber:    "#D4A017",
  amberL:   "#FDF8E0",
  rose:     "#C44B4B",
  roseL:    "#FDEAEA",
  sky:      "#2D7DD2",
  skyL:     "#E8F2FC",
  green:    "#2E7D32",
  greenL:   "#E8F5E9",
};

export const STATUS_CONFIG = {
  paid:     { label: "Paid",       color: T.green,   bg: T.greenL,   gradient: "linear-gradient(135deg, #2E7D32, #43A047)" },
  upcoming: { label: "Upcoming",   color: T.amber,   bg: T.amberL,   gradient: "linear-gradient(135deg, #B8860B, #D4A017)" },
  due:      { label: "Due Today",  color: T.saffron, bg: T.saffronL, gradient: "linear-gradient(135deg, #E8821A, #F5A650)" },
  overdue:  { label: "Overdue",    color: T.rose,    bg: T.roseL,    gradient: "linear-gradient(135deg, #B03030, #C44B4B)" },
};

export const GLOBAL_CSS = `
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

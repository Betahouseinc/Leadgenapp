// Canonical industry labels — the single frontend source of truth.
//
// These must stay in step with two other places:
//   • INDUSTRY_SEARCH_MAP in supabase/functions/scrape-leads/index.ts
//   • the industry_canonical table (migration 20260813_dedup_and_industry.sql)
//
// The dashboard filter previously hardcoded its own list containing
// 'Real estate' (lowercase e) while the scraper wrote 'Real Estate', so that
// filter option silently matched nothing.

export const INDUSTRY_GROUPS = {
  'Technology': ['IT Software', 'EdTech', 'FinTech', 'E-commerce'],
  'Marketing & Media': ['Digital Marketing', 'Social Media Marketing', 'Media & Production', 'Events & Entertainment'],
  'Business Services': ['HR & Staffing', 'Legal Services', 'Logistics & Supply Chain', 'Travel & Hospitality'],
  'Traditional': ['Real Estate', 'Manufacturing', 'Construction & Infrastructure', 'Food & Beverage'],
  'Social Sectors': ['Healthcare', 'Education', 'Pharma', 'Retail'],
}

export const INDUSTRIES = Object.values(INDUSTRY_GROUPS).flat().sort()

// Filter dropdown: 'All' plus every canonical label.
export const INDUSTRY_FILTER_OPTIONS = ['All', ...INDUSTRIES]

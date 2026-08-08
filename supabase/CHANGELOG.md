# Backend changelog

## 2026-08-04

Context: the app was non-functional at the start of this day. Signup failed, and
the AI scoring that the product is sold on had never worked in production. Each
fix below only became visible after the one before it was resolved.

### Infrastructure

- **Supabase project was paused.** Free-tier projects sleep after ~7 days idle.
  Signup failed with `TypeError: Failed to fetch` because the database was
  unreachable. Restored manually.
- **Vercel production was pinned to an April build.** An Instant Rollback
  performed on 2 May disabled auto-deploy, so every commit for three months
  built successfully but never reached `leadgenapp.vercel.app`. Rollback undone
  and the current commit promoted.

### `scrape-leads`

- **Missing `website` column** — Apify returned a website field the `leads`
  table had no column for, so every insert failed. Column added.

- **Gemini authentication (three stacked causes):**
  1. The stored API key was invalid.
  2. Google migrated key formats (`AIzaSy…` → `AQ.Ab…`). New-format keys must be
     sent as an `x-goog-api-key` header; the code passed `?key=` in the query
     string, which returns `ACCESS_TOKEN_TYPE_UNSUPPORTED`.
  3. Model IDs `gemini-2.5-flash` / `gemini-2.5-flash-lite` are no longer
     available to new projects. Updated to `gemini-3.6-flash` and
     `gemini-3.5-flash-lite`.

  Until all three were fixed, every lead was written with a hardcoded fallback
  score of 40 and an empty summary — indistinguishable from real output. The
  failure path now writes `[AI scoring unavailable]` so it is visible in the UI.

- **Apify parameters were wrong:**
  - `maxCrawledPlaces` is not a parameter of the current actor; the correct name
    is `maxCrawledPlacesPerSearch`. The requested limit was silently ignored.
  - The city was interpolated into the search string
    (`"retail store chain in Bengaluru India"`), which Google Maps matches
    literally. A search for Retail returned one result. Location now goes in the
    separate `locationQuery` field.
  - Several `INDUSTRY_SEARCH_MAP` terms were too literal to match anything
    (`retail store chain`, `healthcare clinic hospital`).

- **`scrapeContacts: true`** enabled, which visits each business website on
  Apify's infrastructure to extract emails and social profiles. Chosen over
  fetching websites from the edge function, which would have been sequential and
  prone to timeouts.

- **Apify polling replaced a fixed wait.** `waitForFinish` caps at 60s and the
  code used 55s. Enabling `scrapeContacts` roughly doubled run times, so a run
  taking 1m22s was abandoned at 55s — the data was paid for, completed
  successfully 27 seconds later, and discarded. Now polls every 5s up to a 6
  minute ceiling, and logs run duration and item count.

- **Quota enforcement added** before any Apify or Gemini call, so an
  over-quota request costs nothing. Returns HTTP 402 with plan, limit, used and
  remaining.

### Schema

See `migrations/20260804_leads_pipeline_and_quota.sql`. Notable:

- `profiles` rows were never created on signup, so no user had a plan or usage
  record. Backfilled and a trigger added.
- Three RLS policies on `leads` keyed on `owner_id`, a column populated on 0 of
  230 rows. Dropped. A DELETE policy was missing and has been added.

### Known gaps

- 48 orphaned leads exist with no `user_id`. They are invisible under RLS and
  cannot be deleted from the UI. Retained at the owner's request.
- Email coverage is bounded by website coverage. In a 20-lead Bengaluru retail
  sample only 4 businesses had websites, so at most 4 could yield an email.
  Higher-value segments (IT, pharma) perform considerably better.

## 2026-08-08 — Compliance pass

### Frontend (copy and content only, no functional changes)
- All user-facing instances of "scrape/scraping" replaced with neutral phrasing
  ("aggregates publicly available business directory data", "retrieve public
  listings", etc.) in Landing.jsx and Leads.jsx FAQ
- "Google Maps Scraping" feature card renamed "Business Directory Search"
- "Gemini AI" softened to "our AI model" in feature cards and FAQ answers
- Trademark disclaimer added to footer: "Google Maps and Gemini are trademarks
  of Google LLC. LeadgenAI is not affiliated with, endorsed by, or sponsored
  by Google."
- OG/Twitter meta descriptions in index.html updated to remove "scrape" and
  fix URL from leadgenapp.vercel.app to leadgenai.exommerce.online

### Privacy Policy (Legal.jsx section 3)
- Added paragraph acknowledging that publicly listed business data may
  incidentally include personal data of identifiable individuals (sole
  proprietors, personal mobile numbers listed as business contacts, names
  in public reviews), and that such data is subject to the same section 8
  rights and the same removal process (email admin@exommerce.online)

### Signup (Signup.jsx)
- Added required compliance checkbox: "I confirm I will use exported data in
  compliance with applicable anti-spam, do-not-call, and data protection laws,
  and that I am solely responsible for my outreach."
- Submit button disabled until checkbox is ticked
- Acceptance timestamp stored as `terms_accepted_at` in profiles table

### Cookie consent (index.html, CookieConsent.jsx, main.jsx)
- Google Analytics removed from unconditional load in index.html
- window.__loadGA() function added — fires GA only after user accepts
- Auto-loads GA if prior consent found in localStorage
- CookieConsent banner component added (Accept analytics / Decline)
- Consent persisted to localStorage as `leadgenai_cookie_consent`

### Schema
- `profiles.terms_accepted_at timestamptz` — stores compliance acceptance time

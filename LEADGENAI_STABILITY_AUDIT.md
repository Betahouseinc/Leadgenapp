# LeadGenAI — Stability Audit

**Date:** 2026-08-18
**Scope:** Why lead generation degraded from ~200 leads per run to a cap of 10.
**Method:** Read-only inspection of the repository plus the live production
database (`dbmtdeensqawntawaoyf`). No assumptions — every claim below is backed by
a row in `scrape_runs`, `error_log`, or a line of deployed code.

---

## 1. System map

### Frontend

| Item | Finding |
|---|---|
| Framework | React 19.2 + Vite 8, plain JS (no TypeScript) |
| Routing | `react-router-dom` 7, routes declared in `src/main.jsx` |
| Routes | `/`, `/login`, `/signup`, `/leads`, `/pricing`, `/legal/:doc`, `/reset-password` |
| Lead-gen UI | `src/components/ScrapeModal.jsx` (467 lines) |
| Dashboard | `src/pages/Leads.jsx` (1102 lines) — table, filters, export, drawer |
| State | Local `useState` only. No Redux/Zustand/React Query |
| API calls | Direct `fetch` to Edge Functions + `supabase-js` for table reads |
| Styling | Inline style objects, per-file `T` colour token map |

### Backend

| Item | Finding |
|---|---|
| Platform | Supabase Edge Functions (Deno), project `dbmtdeensqawntawaoyf` (Seoul) |
| Deployed | `scrape-leads` (v50), `daily-scrape` (v1), `create-order`, `razorpay-webhook` |
| In repo, **not** deployed | `apify-webhook` — explicitly marked broken, must not be deployed |
| Database | Postgres 17.6, RLS enabled on `leads` and `scrape_runs` |
| Job model | `scrape_runs` table — status is written only at start and end |
| Queue / workers | **None.** All work happens inside one HTTP invocation |
| Scheduler | `daily-scrape` is deployed but **pg_cron is not installed**, so it never fires |

### Lead pipeline (all inside one `scrape-leads` call)

```
Apify Google Maps actor  →  poll to completion  →  fetch dataset
   →  dedup (within run, then against user's leads)
   →  refresh duplicates in place
   →  Gemini scoring, sequential chunks of 25
   →  ONE bulk upsert
   →  quota increment
```

| Provider | Detail |
|---|---|
| Apify | Actor `nwua9Gu5YrADL7ZDj` (Google Maps), `scrapeContacts: true` |
| Gemini | `gemini-3.6-flash` → `gemini-3.5-flash-lite` fallback, scoring only |
| Google APIs | None beyond Gemini. No OAuth, Gmail, Workspace or Graph anywhere |
| Dedup | Name+city (`dedup_key`), phone (`phone_key`), email |

### Infrastructure

Vercel (frontend, auto-deploy from `main`) · Supabase (DB + functions) ·
secrets `APIFY_API_KEY`, `GEMINI_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`CRON_SECRET` held server-side as Edge Function secrets. Frontend holds only
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` — correct.

---

## 2. The evidence

Every run ever recorded, grouped by requested size:

| limit | completed | failed | stranded | first success | last success |
|---|---|---|---|---|---|
| 200 | 1 | 0 | – | 2026-08-03 | 2026-08-03 |
| 50 | 4 | 3 | – | 2026-05-04 | **2026-08-03** |
| 20 | 5 | 4 | – | 2026-08-03 | 2026-08-06 |
| 10 | 27 | 7 | – | 2026-08-03 | 2026-08-17 |
| 5 | 2 | 0 | **1** | 2026-08-17 | 2026-08-17 |

Live data: 412 leads · 10 users · 59 runs.

**Reliability at the current "safe" cap of 10 is 27/34 ≈ 79%.** Roughly one run in
five fails today. The cap did not make the product reliable; it made the failures
smaller.

Failure messages actually recorded:

| Message | Count | Last seen |
|---|---|---|
| `Worker killed by platform time limit` | 14 | 2026-08-15 17:20 |
| `duplicate key … "leads_name_city_unique"` | 3 | 2026-08-17 13:45 |
| `column "dedup_key" does not exist` | 2 | 2026-08-15 12:02 |

---

## 3. Root causes

### RC-1 — One blocking invocation exceeds the platform wall clock *(primary)*

A single `scrape-leads` call must do all of this inside one worker lifetime:

```
scrape-leads/index.ts:101   APIFY_DEADLINE_MS  = 200s
scrape-leads/index.ts:102   SCORING_BUDGET_MS  = 120s
```

320 seconds of self-declared budget, plus dataset fetch, dedup lookup, duplicate
refresh and the final insert. The platform kills the worker long before either
deadline fires — and **a killed worker never reaches the `catch` block**, so:

- no error is written to `error_log`,
- the `scrape_runs` row is stranded in `running` forever,
- the customer sees a raw platform error.

The 14 `Worker killed by platform time limit` rows were labelled manually after
the fact; that string appears nowhere in the codebase, which is itself the proof
that the code never got to handle them. One row from 2026-08-17 18:43 (limit **5**)
is still stranded in `running` right now.

The function's own comments already suspected this: *"Two minutes for ten leads
points at the platform's wall clock being far lower than the 400s these budgets
were written for."* Confirmed.

### RC-2 — The trigger: `scrapeContacts: true`

`scrape-leads/index.ts:454` enables Apify's contact scraper, which visits **every
discovered business's website** to harvest emails and social profiles. That
multiplies the Apify run's wall time.

The timeline matches exactly:

- 50 leads succeeded 4 times up to **2026-08-03**. 200 leads succeeded **2026-08-03**.
- The first `Worker killed` failure is **2026-08-05**.
- Every 50-lead attempt after that date failed.

Each response was to cut the cap — 200 → 50 → 10 — which treated the symptom and
never the cause. Note the cost of the feature: only **74 of 412 leads (18%)** have
an email at all, so the runtime it buys is not obviously worth it. That is now
measured rather than assumed (see the A/B test in the readiness report).

### RC-3 — No persistence until the very end

Leads are held in memory through discovery, dedup and scoring, then written in
**one** bulk upsert at `index.ts:740`. A worker killed at any point before that
line loses 100% of the work — and it is killed precisely because that path is long.

### RC-4 — All-or-nothing scoring

`scoreChunk` throws `ScoringError` when a chunk cannot be scored, and the throw
propagates to the top-level catch, abandoning the entire run. A single failed
Gemini chunk discards every lead already scraped and scored. **Today, 37 of 50
succeeding keeps zero.**

This was a deliberate choice — the comment at `index.ts:164` argues a half-scored
batch is worse than none, because the previous code faked a score of 40. That
reasoning is sound about *fake scores* but wrong about *discarding real data*: the
schema already has a nullable `score`, and `ScoreBar` in `Leads.jsx:76` already
renders an honest `Unscored` badge for it.

### RC-5 — Browser-coupled progress

`ScrapeModal.jsx` holds a single `fetch` open for the entire run and drives its
progress bar from a lookup table of elapsed seconds (`stageFor`, line 75) — a
fabrication, not a measurement. It tells the user *"Please keep this window open."*
A refresh, a closed tab, or a sleeping laptop loses the result even when the
backend succeeded.

### RC-6 — Unstable dedup identity

Dedup uses `name + city`, phone, and email. Google Maps returns a stable
`placeId`, but it is not in the requested field projection and not stored. A
business that changes its display name is re-inserted as new, and "find only NEW
companies" cannot be implemented reliably on a display name.

### RC-7 — `leads_name_city_unique` — already fixed, no action

A global unique index with no `user_id` in it aborted whole batches (3 failures,
last 2026-08-17 13:45). **Confirmed dropped from production** — it is absent from
`pg_indexes`, and every run after 15:22 that day succeeded. Listed for
completeness only.

### RC-8 — Scheduling is inert

`daily-scrape` is deployed, but `pg_cron` is **not installed**, so nothing invokes
it. Scheduled runs do not happen today.

### RC-9 — No integrations, and no decision-maker data

No OAuth, Gmail, Workspace, Microsoft Graph, Salesforce or HubSpot code exists
anywhere. Gemini is used for scoring only — there is no outreach drafting.

`leads` is **company-level**: `name, email, phone, company, industry, source, city,
state, score, summary, address, rating, review_count, website, notes`. There is no
person name, job title, or profile link. Any "decision maker" panel showing named
individuals would be fabricated.

---

## 4. Ruled out

Checked and **not** contributing:

- **Uncontrolled concurrency / `Promise.all`** — sources run via `Promise.allSettled`
  over at most 2 entries, and Gemini chunks are strictly sequential with a 1.5s gap.
- **Gemini rate limits as a primary cause** — retry/backoff and a fallback model
  already exist; no rate-limit errors appear in `error_log`.
- **Database failures** — the schema is complete. `npm run preflight` passes every
  required column, relation, function and index.
- **Memory** — the dataset projection at `index.ts:456` already trims Google Maps
  items to 7 fields, which was the earlier memory fix.
- **Frontend timeout** — the browser is not timing out; the server-side worker is
  being killed first.

---

## 5. Conclusion

One root cause dominates: **the entire pipeline runs inside a single HTTP request
whose wall clock the platform enforces**, and `scrapeContacts` pushed that
pipeline past the limit in early August. Every subsequent cap reduction traded
capacity for a slightly lower chance of hitting the same wall.

The fix is not a bigger budget or a smaller cap — it is to stop doing all the work
in one request. Splitting the job into short slices that persist as they go
removes the wall-clock ceiling as a correctness concern entirely, and makes RC-3,
RC-4 and RC-5 fixable at the same time.

See `LEADGENAI_EVENT_READINESS.md` for the implementation, tests and results.

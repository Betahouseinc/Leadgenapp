# LeadGenAI — API Days Event Readiness

**Date:** 2026-08-18
**Repo:** `C:\Users\Hitesh M\Desktop\ABC\LeadGen App`
**Commit:** `f8ef690` — *Slice lead generation into resumable jobs that persist as they go*

---

## ⚠️ ONE ACTION REQUIRED BEFORE THE DEMO

**The backend is deployed and verified in production. The frontend is committed but NOT pushed.**

`git push` was refused: the machine's stored GitHub credential is `rentai-admin`,
which lacks write access to `Betahouseinc/Leadgenapp`. Switching to the
`bhavinf16` account requires a credential action I am not permitted to perform.

Production is therefore running the **new backend with the old frontend**, and
those two disagree: the old modal expects the scrape to finish inside one HTTP
request, but the new endpoint returns a job id in ~3 seconds. Leads still save
correctly — the worker does that in the background — but the old UI will report
"complete" immediately and the list will look empty until the job finishes a
minute or two later.

**Fix it with one command** (from the repo root, as an account with write access):

```bash
git push origin main
```

Vercel auto-deploys from `main`. Verify afterwards that
https://leadgenapp.vercel.app shows "Find qualified leads **with AI**" (not "in
under 60 seconds") and that `/dashboard` loads.

If you cannot push before the demo, roll the backend back instead so the halves
match again — see [Rollback](#rollback).

---

## TESTED SAFE CAPACITY = 50 LEADS

Established by the acceptance matrix below, not by a single lucky run. 50 is the
largest size that passed **three consecutive runs** with every lead discovered,
saved and scored.

100 was **not** tested and must not be advertised. The per-run cap in code is 50.

---

## 1. Root causes

Diagnosed from production data, not assumption. Full working in
`LEADGENAI_STABILITY_AUDIT.md`.

| # | Cause | Evidence |
|---|---|---|
| **RC-1** | **The whole pipeline ran inside one HTTP request.** `APIFY_DEADLINE_MS` (200s) + `SCORING_BUDGET_MS` (120s) exceeded the platform wall clock, and a killed worker never reaches its `catch` — so no error was logged and the job sat in `running` forever. | 14 runs `Worker killed by platform time limit`; 1 row stranded since 2026-08-17 18:43 |
| **RC-2** | **`scrapeContacts: true` was the trigger.** It makes Apify visit every business website, multiplying run time until it crossed the ceiling. | 50 and 200 succeeded until 2026-08-03; first failure 2026-08-05; every 50 after that failed |
| **RC-3** | **Nothing persisted until the end.** One bulk insert after everything succeeded, so a killed worker lost 100% of the work. | `scrape-leads/index.ts:740` (old) |
| **RC-4** | **All-or-nothing scoring.** `scoreChunk` threw `ScoringError`, aborting the run and discarding every already-scraped lead. | 37/50 kept 0 |
| **RC-5** | **Progress was fabricated.** The modal interpolated a percentage from elapsed seconds and held one `fetch` open, so a refresh lost the result. | `stageFor()` (old) |
| **RC-6** | **Dedup had no stable identity** — name+city only, so a renamed listing re-inserted. | no `place_id` stored |
| **RC-7** | **`CRON_SECRET` was never set.** Discovered during testing: the worker's internal call was refused 403, and the scheduled path could never have authenticated either. | `supabase secrets list` |
| **RC-8** | **Scheduling was doubly dead** — `pg_cron` not installed *and* the `recent_searches` view `daily-scrape` reads does not exist. | `to_regclass` returned NULL |
| RC-9 | `leads_name_city_unique` aborted whole batches. **Already fixed before this work** — confirmed absent from `pg_indexes`. | last error 2026-08-17 13:45 |

---

## 2. Architecture change

```
BEFORE   one request:  start Apify → poll 200s → score 120s → insert everything
AFTER    create job (~3s) → short slices, each persisting → client polls
```

`scrape-leads` now only creates the job. `scrape-worker` (new) advances it one
bounded slice at a time and re-invokes itself until terminal:

| Stage | Work | Persisted before moving on |
|---|---|---|
| `discovering` | poll the Apify run | `apify_run_id`, heartbeat |
| `saving` | dedup, then **insert companies unscored** | companies, quota charged |
| `scoring` | one Gemini chunk per pass | scores, per chunk |
| `finalising` | `completed` or `partial` | counters |

Why this fixes it: no slice comes close to the wall clock, so the ceiling stops
being a correctness problem. Companies land in the database **before** Gemini is
asked for anything, which is what makes "keep the 37" true. A browser polls
`scrape_runs` — which already had an RLS policy for it, so **no new endpoint and
no new infrastructure** was added.

Recovery: `attempts` caps the chain; `heartbeat_at` marks a broken chain;
`reap_stalled_scrape_runs()` closes jobs whose chain died; the UI reconnects to
any in-flight run on mount, and can ask `scrape-leads` (`action: 'resume'`) to
restart a stalled chain.

**Deviation from plan:** scoring failures are now retried *across slices* rather
than giving up on first failure. The first 50-lead matrix produced three
`partial` runs, all Gemini free-tier rate limits — which clear on their own. With
the retry, 50×3 passed cleanly. Bounded by `SCORING_GIVE_UP_MS` (6 min) so a job
still always terminates.

---

## 3. Database changes

Applied to production via `supabase db query --linked -f` (never `db push` — this
schema is hand-built and its migration ledger is empty).

- `20260818_job_slices.sql` — job columns on `scrape_runs` (`apify_run_id`,
  `stage`, `discovered_count`, `enriched_count`, `scored_count`, `failed_count`,
  `duplicate_count`, `attempts`, `heartbeat_at`, `started_at`, `finished_at`,
  `enrich_contacts`); `leads.place_id` + partial unique index; a partial index
  for unscored rows; `reap_stalled_scrape_runs()`.
- `20260818_lead_drafts.sql` — `lead_drafts` table with RLS for AI output.

All additive. Nothing dropped or retyped, so the previous function kept working
throughout. `scripts/preflight.mjs` now guards every new object.

---

## 4. Files changed

| File | Change |
|---|---|
| `supabase/functions/_shared/pipeline.ts` | **New** — shared config, industry map, identity, Gemini client |
| `supabase/functions/scrape-worker/index.ts` | **New** — the slice worker |
| `supabase/functions/draft-outreach/index.ts` | **New** — Gemini research + outreach |
| `supabase/functions/scrape-leads/index.ts` | Rewritten as job creator + resume |
| `supabase/migrations/20260818_*.sql` | **New** — the two migrations above |
| `src/components/ScrapeModal.jsx` | Polls real job state; reconnects; real counters |
| `src/pages/Dashboard.jsx` | **New** — the dashboard at `/dashboard` |
| `src/pages/Landing.jsx` | Removed the untested 60-second claims |
| `src/main.jsx`, `src/index.css` | Route; indeterminate-bar keyframe |
| `scripts/preflight.mjs` | Guards the new columns, index and function |
| `eslint.config.js` | Ignore untracked scratch dirs (see §9) |

---

## 5. Test results

All against **production** Supabase, on a throwaway account
(`apidays-capacity-test@leadgenai.test`, agency plan) so no customer data mixed in.

### Acceptance matrix — final (post-fix engine)

| Size | Runs | Result | Discovered | Saved | Scored | Time |
|---|---|---|---|---|---|---|
| 10 | 3 | 3 completed | 30 | **30** | 30 | ~2 min |
| 25 | 3 | 3 completed | 75 | **75** | 75 | 1.5–2.5 min |
| **50** | **3** | **3 completed** | **150** | **150** | **150** | **145s, 146s, 197s** |

**Across all 13 runs of the new engine: 430 leads requested, 430 saved. Zero data
loss. Zero stranded jobs.**

Three earlier runs finished `partial` (leads saved, none scored) on the pre-fix
worker — all Gemini rate limits. After the cross-slice retry, 50×3 passed clean.

### Contact enrichment A/B (25 leads each)

| Config | Time | Saved | **With email** | With phone |
|---|---|---|---|---|
| Enrichment **ON** | 112s | 25 | **18 (72%)** | 23 |
| Enrichment **OFF** | 39s | 25 | **0 (0%)** | 21 |

**Decision: keep enrichment ON.** Google Maps alone returns *no* email addresses,
so turning it off makes the product unusable for outreach. It is ~3× slower, but
that no longer risks the job — it is a config flag (`enrich_contacts`) either way.

### Behaviours verified directly

- **Partial success** — a run saved 50 companies with 0 scored; all 50 remained in
  the list, labelled `Unscored`. The old engine would have kept none.
- **Refresh survival** — dashboard and modal both reconnected to a live job on a
  fresh page load, showing real stage and counters.
- **Ownership** — `draft-outreach` returned 404 for a lead belonging to another
  user, confirming the check.
- **No secrets in the bundle** — only `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` are referenced; no Apify/Gemini/service keys present.
- **Responsive** — no horizontal overflow at 375px, 768px or 1280px.

---

## 6. Integration status

| Integration | Status | Detail |
|---|---|---|
| **Google Gemini** | ✅ **LIVE** | Real API calls. Scores every lead; powers *Research with Gemini* and *Draft outreach*. Verified end to end — output cites the lead's real rating and review count. Falls back `gemini-3.6-flash` → `gemini-3.5-flash-lite`. |
| **Apify** | ✅ **LIVE** | Google Maps discovery + contact enrichment. |
| **CSV / Excel export** | ✅ **LIVE** | Pre-existing, on the leads page. |
| **Microsoft 365** | ⛔ Coming soon | No Azure app registration exists. Shown as *"Coming soon · Microsoft Graph"*. Nothing implies it is connectable. To build later: register an Entra app, add redirect URI, grant `Mail.ReadWrite`/`Mail.Send`, complete admin consent. |
| **Salesforce** | ⛔ Coming soon | Not implemented, per scope lock. |
| **HubSpot** | ⛔ Coming soon | Not implemented, per scope lock. |
| **Slack / Zapier** | ⛔ Coming soon | Roadmap cards only. |

**Gmail sending is deliberately absent.** Drafts are generated and copied by hand
— no mailbox is connected and outreach should have human approval regardless.

### Demo flow that works today

`Dashboard → Top opportunities → ✦ Research with Gemini → ✉ Draft outreach → review → Copy`

Real example produced during testing (Ascent Software Solutions, Pune, score 98):

> I noticed Ascent Software Solutions maintains a strong 5-star rating across over
> 1,200 reviews in Pune… Are you currently exploring external support for any
> upcoming AI or data integration projects?

The 5-star/1,200-review detail is read from the real scraped record. The prompts
forbid inventing facts, contact names or job titles.

---

## 7. Known limitations

1. **Frontend not pushed** — see the box at the top. Highest priority.
2. **Gemini is on a free-tier key.** Back-to-back jobs hit per-minute rate limits;
   that is what caused every `partial`. The retry absorbs it, but a run may take
   ~1 extra minute under load. **Strongly recommend a paid Gemini key before the
   demo** — it removes the main source of variability.
3. **Scheduled runs are not active.** `pg_cron` is not installed *and*
   `recent_searches` does not exist, so `daily-scrape` would fail on its first
   query. The dashboard states this plainly. Not enabled tonight: switching on an
   unattended job that spends Apify credit the night before an event is the wrong
   risk. The UI and the `place_id` exclusion key are in place for it.
4. **No decision-maker data.** `leads` is company-level. The dashboard says
   "Decision-maker enrichment coming soon" rather than inventing names.
5. **100 leads untested.** Do not claim it.
6. **Discovery has no incremental progress.** Apify reports results only at the
   end, so that phase shows an indeterminate bar — deliberately, rather than a
   fabricated percentage.
7. **`apify-webhook` is still broken and undeployed.** Untouched; leave it that way.
8. **Test data.** The throwaway account holds ~430 test leads. Delete with:
   `delete from leads where user_id = '25b78f39-37b9-4efe-b30d-c65cf9100d1b';`

---

## 8. Deployment

- **Production URL:** https://leadgenapp.vercel.app
- **Supabase:** `dbmtdeensqawntawaoyf` (Seoul)
- **Deployed edge functions:** `scrape-leads`, `scrape-worker`, `draft-outreach` ✅
- **Migrations applied:** both ✅
- **Secret added:** `CRON_SECRET` (was missing) ✅
- **Frontend:** committed `f8ef690`, **not pushed** ⛔

### Rollback

The frontend was never pushed, so there is nothing to roll back there.

To revert the backend to the previous single-request engine:

```bash
git revert f8ef690
npx supabase functions deploy scrape-leads
```

The migrations are **additive and safe to leave** — the old function ignores the
new columns. Do not drop them; `place_id` and the job columns hold real data now.

If you need the old and new halves to match *without* pushing the frontend, this
revert is the way to do it: it restores the blocking endpoint the deployed UI
expects. You lose the reliability fix, so prefer pushing the frontend.

---

## 9. Recommended post-event work

1. **Paid Gemini key** — removes the last source of run-to-run variability.
2. **Enable scheduling properly** — `create extension pg_cron`, create the
   `recent_searches` view (or point `daily-scrape` at `scrape_runs` directly,
   which is where that view got its data anyway), then set `app.edge_url` and
   `app.cron_secret`. Exclude prior companies via `place_id`.
3. **Test 100** using the same three-run gate before advertising it.
4. **Decision-maker enrichment** — the biggest product gap; the dashboard already
   has the slot for it.
5. **Delete or fix `apify-webhook`** — dead, broken, and misleading in the repo.
6. **Clean the repo** — `.claude/worktrees/`, `.clone/` and `Downloads/Rentok`
   are untracked scratch directories inside the repo that produced 400+ lint
   errors and made `npm run lint` useless as a deploy gate. They are ignored in
   `eslint.config.js` now, but they should not be there at all.
7. **Microsoft Graph** when a tenant and admin consent are available.

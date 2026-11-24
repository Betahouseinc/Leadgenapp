# Supabase backend

Project ref: `dbmtdeensqawntawaoyf` (region: ap-northeast-2)

## Keeping this folder in sync

Edge functions are frequently edited directly in the Supabase dashboard. When
that happens this folder goes stale and the only copy of the code lives in one
place. Pull it back down after any dashboard edit:

```bash
npx supabase login
npx supabase link --project-ref dbmtdeensqawntawaoyf
npx supabase functions download <function-name>   # repeat for each one edited
git add supabase/ && git commit -m "sync edge functions from Supabase"
```

Prefer editing here and deploying, rather than editing in the dashboard:

```bash
npx supabase functions deploy scrape-leads
npx supabase functions deploy scrape-worker
npx supabase functions deploy draft-outreach
npx supabase functions deploy enrich-lead
npx supabase functions deploy daily-scrape --no-verify-jwt
npx supabase functions deploy daily-summary
```

`daily-scrape` needs `--no-verify-jwt`: pg_cron sends no JWT, and the function
authenticates the call with `x-cron-secret` instead.

## Edge functions

| Function | Trigger | Purpose |
|---|---|---|
| `scrape-leads` | Search button, or the nightly job | Checks quota, creates a `scrape_runs` job and returns at once; `action: 'resume'` restarts a stalled job |
| `scrape-worker` | Invoked by `scrape-leads`, then by itself | Advances a job one short slice at a time: Google Places discovery → save → Gemini scoring → finalise |
| `enrich-lead` | "Find email" on a lead | Website check, then Gemini with Search grounding; decision-makers via Hunter when `HUNTER_API_KEY` is set |
| `draft-outreach` | "Research" / "Draft outreach" on a lead | Gemini account brief and outreach draft |
| `daily-scrape` | pg_cron, every 15 min 02:30–04:15 IST | Re-runs each user's recent searches, writes summaries |
| `daily-summary` | Polled by a notifier | Serves unsent summaries as JSON or CSV |
| `create-order`, `razorpay-webhook` | Checkout | Payments |

`daily-scrape` does not scrape itself — it calls `scrape-leads`, which already
owns scoring, dedup and quota. Keep it that way; reimplementing any of that here
is how the manual and scheduled paths drift apart.

## Secrets

Set in the dashboard under Edge Functions → Secrets. Never commit these.

| Name | Used by |
|---|---|
| `GOOGLE_PLACES_API_KEY` | scrape-leads, scrape-worker |
| `GEMINI_API_KEY` | scrape-worker, enrich-lead, draft-outreach |
| `HUNTER_API_KEY` *(optional)* | enrich-lead — decision-maker lookup is off without it |
| `SUPABASE_SERVICE_ROLE_KEY` | all except the Razorpay functions |
| `CRON_SECRET` | scrape-leads, scrape-worker, daily-scrape, daily-summary |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET` | create-order, razorpay-webhook |

Optional tuning: `DAILY_RUN_BUDGET_MS`, `GROUNDED_DAILY_LIMIT`,
`HUNTER_MAX_VERIFICATIONS`.

`CRON_SECRET` is how the scheduled job acts for a user without a JWT.
`scrape-leads` trusts a `user_id` in the request body **only** when this header
matches. If the secret is unset the scheduled path is refused rather than
allowed — an unset secret must never degrade to "no auth required".

pg_cron also needs it, from the database side. Store both values in Supabase
Vault (one-time, in the SQL editor) — `alter database ... set app.*` is refused
on current Supabase projects, and is only read as a legacy fallback:

```sql
select vault.create_secret('https://dbmtdeensqawntawaoyf.supabase.co/functions/v1', 'leadgen_edge_url');
select vault.create_secret('<same value as CRON_SECRET>', 'leadgen_cron_secret');
```

See `migrations/20260926_daily_runs_and_contacts.sql`, which owns the schedule.

## Migrations

`migrations/` is the record of schema changes. Anything applied through the SQL
editor should be added here as a dated, idempotent file so the schema can be
rebuilt from scratch.

Files are applied in filename order. The 2026-08-13 set has one ordering
dependency worth knowing: `error_log` creates an admin-only policy that reads
`profiles.role`, which properly belongs to `roles_and_masking` but sorts after
it — so the column is added idempotently in both.

| File | What it does |
|---|---|
| `20260813_dedup_and_industry.sql` | Industry normalisation, **deletes duplicate leads** (backed up first) |
| `20260813_error_log.sql` | Pipeline error table + 30-day prune |
| `20260813_lead_stats.sql` | `lead_stats()` for the dashboard cards |
| `20260813_recent_searches_and_cron.sql` | `recent_searches` view, `daily_summaries`, pg_cron schedule |
| `20260813_roles_and_masking.sql` | `profiles.role`, `leads_view` with contact masking |
| `20260813_score_backfill.sql` | Nulls out the fabricated score of 40 |

### Before applying the dedup migration

It removes rows. Dry-run it first — this parses the whole file and reports the
counts without keeping anything:

```sql
begin;
\i supabase/migrations/20260813_dedup_and_industry.sql
select count(*) as would_delete from leads_dedup_backup;
rollback;
```

Deleted rows are copied to `leads_dedup_backup`, so a real run is reversible.
The oldest row per business is kept, because it carries the customer's notes
and status.

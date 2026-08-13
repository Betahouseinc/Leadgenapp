# Supabase backend

Project ref: `dbmtdeensqawntawaoyf` (region: ap-northeast-2)

## Keeping this folder in sync

Edge functions are frequently edited directly in the Supabase dashboard. When
that happens this folder goes stale and the only copy of the code lives in one
place. Pull it back down after any dashboard edit:

```bash
npx supabase login
npx supabase link --project-ref dbmtdeensqawntawaoyf
npx supabase functions download scrape-leads
npx supabase functions download create-order
npx supabase functions download razorpay-webhook
git add supabase/ && git commit -m "sync edge functions from Supabase"
```

Prefer editing here and deploying, rather than editing in the dashboard:

```bash
npx supabase functions deploy scrape-leads
npx supabase functions deploy daily-scrape
npx supabase functions deploy daily-summary
```

## Edge functions

| Function | Trigger | Purpose |
|---|---|---|
| `scrape-leads` | "Run scrape" button, or the nightly job | Scrape → score → dedup → insert |
| `daily-scrape` | pg_cron, 21:00 UTC (02:30 IST) | Re-runs each user's recent searches, writes summaries |
| `daily-summary` | Polled by a notifier | Serves unsent summaries as JSON or CSV |
| `create-order`, `razorpay-webhook` | Checkout | Payments |

`daily-scrape` does not scrape itself — it calls `scrape-leads`, which already
owns scoring, dedup and quota. Keep it that way; reimplementing any of that here
is how the manual and scheduled paths drift apart.

## Secrets

Set in the dashboard under Edge Functions → Secrets. Never commit these.

| Name | Used by |
|---|---|
| `APIFY_API_KEY` | scrape-leads |
| `GEMINI_API_KEY` | scrape-leads |
| `SUPABASE_SERVICE_ROLE_KEY` | scrape-leads, daily-scrape, daily-summary |
| `CRON_SECRET` | scrape-leads, daily-scrape, daily-summary |

`CRON_SECRET` is how the scheduled job acts for a user without a JWT.
`scrape-leads` trusts a `user_id` in the request body **only** when this header
matches. If the secret is unset the scheduled path is refused rather than
allowed — an unset secret must never degrade to "no auth required".

pg_cron also needs it, from the database side:

```sql
alter database postgres set app.edge_url    = 'https://dbmtdeensqawntawaoyf.functions.supabase.co';
alter database postgres set app.cron_secret = '<same value as CRON_SECRET>';
```

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

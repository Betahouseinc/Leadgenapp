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
npx supabase functions download apify-webhook
git add supabase/ && git commit -m "sync edge functions from Supabase"
```

Prefer editing here and deploying, rather than editing in the dashboard:

```bash
npx supabase functions deploy scrape-leads
```

## Secrets

Set in the dashboard under Edge Functions → Secrets. Never commit these.

| Name | Used by |
|---|---|
| `APIFY_API_KEY` | scrape-leads |
| `GEMINI_API_KEY` | scrape-leads |
| `SUPABASE_SERVICE_ROLE_KEY` | scrape-leads |

## Migrations

`migrations/` is the record of schema changes. Anything applied through the SQL
editor should be added here as a dated, idempotent file so the schema can be
rebuilt from scratch.

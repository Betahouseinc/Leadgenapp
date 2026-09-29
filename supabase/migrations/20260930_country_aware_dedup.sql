-- 2026-09-30 — Country in the lead identity
--
-- dedup_key was name|city, and (user_id, dedup_key) is unique and is the upsert
-- conflict target for new leads. Once searches can run in several countries,
-- two different businesses with the same name in same-named cities collide:
-- Starbucks in Birmingham GB and Starbucks in Birmingham US would merge, and
-- the insert would overwrite the held lead with the other's details.
--
-- The key becomes name|city|country. A lead with no country predates
-- international search and was India, so null is keyed as 'in' — otherwise every
-- older Indian lead would stop matching its own re-scrape.
--
-- Mirrors dedupKey() in supabase/functions/_shared/pipeline.ts. Keep in step.
--
-- Postgres 17 changes a stored generated column in place; the table is
-- rewritten and uq_leads_user_dedup_key rebuilt. Adding a component can only
-- make keys more distinct, so the unique index cannot fail on existing rows.
-- Column grants on dedup_key are kept.
--
-- Apply in the SQL editor, or:
--   npx supabase db query --linked -f supabase/migrations/20260930_country_aware_dedup.sql

alter table public.leads
  alter column dedup_key set expression as (
    regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g')
    || '|' ||
    regexp_replace(lower(coalesce(city, '')), '[^a-z0-9]+', '', 'g')
    || '|' ||
    regexp_replace(lower(coalesce(country, 'IN')), '[^a-z0-9]+', '', 'g')
  );

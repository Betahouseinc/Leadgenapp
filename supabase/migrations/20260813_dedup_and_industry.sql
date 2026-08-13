-- 2026-08-13 — Industry normalisation and real deduplication
--
-- Two defects this addresses:
--
--   1. Industry values arrive as free text from Gemini, so "Real Estate" and
--      "Real estate" coexist as separate tags. The dashboard filter hardcoded
--      the lowercase spelling, so selecting it matched zero real rows.
--
--   2. Deduplication existed only *within* a single scrape run, held in memory.
--      Nothing compared against already-stored rows, so every re-run of the same
--      search re-inserted the same businesses and consumed the customer's quota
--      doing it. The `onConflict: 'name,city'` fallback in the edge function
--      referenced a unique constraint that was never created, so it never fired.
--
-- Enforcement lives in the database rather than only in the edge function, so
-- the scheduled job and any manual insert are covered by the same rules.
--
-- Idempotent, but note section 3 DELETES duplicate rows. Read it before running.

-- ---------------------------------------------------------------------------
-- 1. Canonical industry list
--
-- Must stay in step with INDUSTRY_SEARCH_MAP in the scrape-leads edge function
-- and src/constants/industries.js on the frontend. Matching is done on a
-- squashed key (lowercase, alphanumeric only) so "Real estate", "REAL ESTATE",
-- "Real-Estate" and "real estate" all collapse to one canonical label.
-- ---------------------------------------------------------------------------

create or replace function public.industry_key(v text)
returns text as $$
  select regexp_replace(lower(coalesce(v, '')), '[^a-z0-9]+', '', 'g');
$$ language sql immutable;

create table if not exists industry_canonical (
  key   text primary key,
  label text not null
);

insert into industry_canonical (key, label)
select public.industry_key(label), label
from (values
  ('Real Estate'), ('IT Software'), ('EdTech'), ('FinTech'),
  ('Social Media Marketing'), ('Digital Marketing'), ('Media & Production'),
  ('Manufacturing'), ('Healthcare'), ('Retail'), ('Education'), ('Pharma'),
  ('Logistics & Supply Chain'), ('Food & Beverage'), ('E-commerce'),
  ('Construction & Infrastructure'), ('Legal Services'), ('HR & Staffing'),
  ('Events & Entertainment'), ('Travel & Hospitality')
) as t(label)
on conflict (key) do update set label = excluded.label;

-- Common variants that do not squash to the canonical key on their own.
insert into industry_canonical (key, label) values
  (public.industry_key('Real Estate Agency'),   'Real Estate'),
  (public.industry_key('Software'),             'IT Software'),
  (public.industry_key('IT'),                   'IT Software'),
  (public.industry_key('Information Technology'),'IT Software'),
  (public.industry_key('Ecommerce'),            'E-commerce'),
  (public.industry_key('Health Care'),          'Healthcare'),
  (public.industry_key('Food and Beverage'),    'Food & Beverage'),
  (public.industry_key('Media and Production'), 'Media & Production'),
  (public.industry_key('HR and Staffing'),      'HR & Staffing'),
  (public.industry_key('Logistics'),            'Logistics & Supply Chain'),
  (public.industry_key('Construction'),         'Construction & Infrastructure')
on conflict (key) do update set label = excluded.label;

-- Unknown values are returned trimmed rather than discarded: losing a label we
-- do not recognise is worse than showing an untidy one.
create or replace function public.normalise_industry(v text)
returns text as $$
  select coalesce(
    (select c.label from industry_canonical c where c.key = public.industry_key(v)),
    nullif(btrim(coalesce(v, '')), '')
  );
$$ language sql stable;

-- ---------------------------------------------------------------------------
-- 2. Normalise existing rows
-- ---------------------------------------------------------------------------

update leads
   set industry = public.normalise_industry(industry)
 where industry is distinct from public.normalise_industry(industry);

-- ---------------------------------------------------------------------------
-- 3. Remove existing duplicates
--
-- !! THIS DELETES ROWS. Preview first:
--
--   select user_id,
--          regexp_replace(lower(name), '[^a-z0-9]+', '', 'g') as n,
--          regexp_replace(lower(coalesce(city,'')), '[^a-z0-9]+', '', 'g') as c,
--          count(*)
--     from leads
--    group by 1,2,3 having count(*) > 1
--    order by count(*) desc;
--
-- The oldest row per (user, business, city) is kept because it carries the
-- earliest created_at and any notes or status the customer has since set on it.
-- Deleted rows are copied to leads_dedup_backup first, so this is reversible.
-- ---------------------------------------------------------------------------

-- Guarded on the unique index from section 4, which only exists once this has
-- already run. Without the guard a second run would fail: `select l.*` would by
-- then include the generated dedup_key/phone_key columns, which the backup
-- table (created before they existed) does not have.
do $$
begin
  if exists (select 1 from pg_indexes where indexname = 'uq_leads_user_dedup_key') then
    raise notice 'Deduplication already applied - skipping.';
    return;
  end if;

  create table if not exists leads_dedup_backup (like leads including defaults);

  with ranked as (
    select id,
           row_number() over (
             partition by user_id,
                          regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g'),
                          regexp_replace(lower(coalesce(city, '')), '[^a-z0-9]+', '', 'g')
             order by created_at asc, id asc
           ) as rn
      from leads
  )
  insert into leads_dedup_backup
  select l.* from leads l join ranked r on r.id = l.id
   where r.rn > 1;

  delete from leads l
   using leads_dedup_backup b
   where b.id = l.id;

  raise notice 'Deduplication complete. Removed rows are in leads_dedup_backup.';
end $$;

-- ---------------------------------------------------------------------------
-- 4. Prevent new duplicates
--
-- The key is scoped to user_id: two customers searching the same city are each
-- entitled to their own copy of a business. A global constraint would let one
-- customer's scrape starve another's.
-- ---------------------------------------------------------------------------

alter table leads add column if not exists dedup_key text
  generated always as (
    regexp_replace(lower(coalesce(name, '')), '[^a-z0-9]+', '', 'g')
    || '|' ||
    regexp_replace(lower(coalesce(city, '')), '[^a-z0-9]+', '', 'g')
  ) stored;

create unique index if not exists uq_leads_user_dedup_key
  on leads (user_id, dedup_key);

-- Phone formatting is wildly inconsistent between listings (+91 80 1234 5678,
-- 08012345678, 080-12345678), so comparing the raw column finds nothing. The
-- last 10 digits are the stable part in India and are what ingest matches on.
alter table leads add column if not exists phone_key text
  generated always as (
    right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
  ) stored;

-- Secondary lookups for the ingest-time phone/email check. Partial, because a
-- large share of scraped rows have neither and NULLs need no index.
create index if not exists idx_leads_user_phone_key
  on leads (user_id, phone_key) where phone_key <> '';
create index if not exists idx_leads_user_email
  on leads (user_id, email) where email is not null and email <> '';

-- ---------------------------------------------------------------------------
-- 5. Normalise on write
--
-- Belt and braces: the edge function normalises too, but this covers the
-- scheduled job, the SQL editor, and anything added later.
-- ---------------------------------------------------------------------------

create or replace function public.normalise_lead()
returns trigger as $$
begin
  new.industry := public.normalise_industry(new.industry);
  new.name     := nullif(btrim(coalesce(new.name, '')), '');
  new.city     := nullif(btrim(coalesce(new.city, '')), '');
  new.email    := nullif(lower(btrim(coalesce(new.email, ''))), '');
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_normalise_lead on leads;
create trigger trg_normalise_lead
  before insert or update on leads
  for each row execute function public.normalise_lead();

-- ---------------------------------------------------------------------------
-- 6. Verification
-- ---------------------------------------------------------------------------

-- select industry, count(*) from leads group by 1 order by 2 desc;
-- select count(*) from leads_dedup_backup;   -- how many duplicates were removed

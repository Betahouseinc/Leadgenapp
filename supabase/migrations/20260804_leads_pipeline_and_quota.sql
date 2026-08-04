-- 2026-08-04 — Lead pipeline, quota enforcement, and RLS cleanup
--
-- Consolidates schema changes applied live via the Supabase SQL editor on
-- 2026-08-04. Written to be idempotent so it is safe to re-run against an
-- environment that already has some of these objects.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------

-- Apify returns a website per place; the insert previously failed because this
-- column did not exist, so every scraped lead was silently dropped.
alter table leads add column if not exists website text;

-- Per-lead free-text notes and an auto-stamped last-contacted date.
alter table leads add column if not exists notes text;
alter table leads add column if not exists last_contacted_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. Indexes (support status filtering and the three sort orders)
-- ---------------------------------------------------------------------------

create index if not exists idx_leads_user_status  on leads (user_id, status);
create index if not exists idx_leads_user_created on leads (user_id, created_at desc);
create index if not exists idx_leads_user_score   on leads (user_id, score desc);

-- ---------------------------------------------------------------------------
-- 3. Profile bootstrap
--
-- Signup created an auth.users row but no profiles row, so plan_id/leads_used
-- were never populated and quota could not be evaluated.
-- ---------------------------------------------------------------------------

insert into profiles (id, email, plan_id, leads_used)
select u.id, u.email, 'free', 0
from auth.users u
left join profiles p on p.id = u.id
where p.id is null;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, plan_id, leads_used)
  values (new.id, new.email, 'free', 0)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 4. last_contacted_at auto-stamp
--
-- Owned by the database so the frontend never writes this value directly.
-- ---------------------------------------------------------------------------

create or replace function public.touch_last_contacted()
returns trigger as $$
begin
  if new.status is distinct from old.status
     and new.status in ('contacted', 'follow_up', 'converted') then
    new.last_contacted_at := now();
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_touch_last_contacted on leads;
create trigger trg_touch_last_contacted
  before update on leads
  for each row execute function public.touch_last_contacted();

-- ---------------------------------------------------------------------------
-- 5. RLS cleanup
--
-- Three policies keyed on leads.owner_id, a column populated on 0 of 230 rows.
-- They were dead code that created false confidence about access control; the
-- user_id policies are the ones actually doing the work. A DELETE policy was
-- missing entirely, so users could not remove their own leads.
-- ---------------------------------------------------------------------------

drop policy if exists "Owner can select own leads" on leads;
drop policy if exists "Owner can update own leads" on leads;
drop policy if exists "Owner can insert own leads" on leads;

drop policy if exists "Users delete own leads" on leads;
create policy "Users delete own leads" on leads
  for delete using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 6. Quota
--
-- Counts from the leads table rather than maintaining a counter: the log is the
-- source of truth, so a partially-failed scrape can't leave usage out of sync.
--
-- Two deliberate exclusions:
--   * leads whose AI summary reports scoring failure — the user should not
--     spend quota on a lead that never received the product's core value.
--   * leads created before 2026-08-04 — test data from development, grandfathered.
-- ---------------------------------------------------------------------------

create or replace function public.check_lead_quota(p_user_id uuid)
returns json as $$
declare
  v_limit int;
  v_used  int;
  v_plan  text;
begin
  select p.plan_id into v_plan from profiles p where p.id = p_user_id;
  if v_plan is null then v_plan := 'free'; end if;

  select pl.leads_per_month into v_limit from plans pl where pl.id = v_plan;
  if v_limit is null then v_limit := 10; end if;

  select count(*) into v_used
  from leads l
  where l.user_id = p_user_id
    and l.created_at >= date_trunc('month', now())
    and l.created_at >= timestamptz '2026-08-04'
    and coalesce(l.summary, '') not like '%unavailable%'
    and coalesce(l.summary, '') <> '';

  return json_build_object(
    'plan',      v_plan,
    'limit',     v_limit,
    'used',      v_used,
    'remaining', case when v_limit < 0 then 999999 else greatest(v_limit - v_used, 0) end,
    'unlimited', v_limit < 0
  );
end;
$$ language plpgsql security definer;

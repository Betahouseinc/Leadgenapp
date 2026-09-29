-- 2026-09-30 â€” Close three ways around plan limits
--
-- Found while fixing enrich-lead, which returned unmasked emails to free plans.
-- Each of these let a signed-in user reach, through the public REST API, data or
-- privileges their plan does not include. The dashboard never used any of these
-- paths, so nothing in the app changes.
--
-- Apply in the SQL editor, or:
--   npx supabase db query --linked -f supabase/migrations/20260930_close_plan_bypasses.sql

-- ---------------------------------------------------------------------------
-- 1. leads: contact columns only through leads_view
--
-- "Users see own leads" lets a user select their own rows straight from the
-- table, which skips leads_view and its masking â€” a free plan could read every
-- email and phone with one API call. The policy stays (updates to status and
-- notes need it); what changes is which columns the role may select.
--
-- leads_view, lead_stats() and the edge functions run as the owner or the
-- service role and are unaffected. raw_data is withheld too: it is the provider's
-- original record and can carry the same contact details.
--
-- A column added to leads later is NOT readable by users until it is added to
-- this grant â€” safe by default.
-- ---------------------------------------------------------------------------

revoke select on public.leads from anon, authenticated;

grant select (
  id, created_at, name, company, industry, source, city, state, score, summary,
  status, owner_id, address, rating, review_count, user_id, scrape_run_id,
  website, notes, last_contacted_at, dedup_key, phone_key, last_scraped_at,
  place_id, enriched_at, enrichment_source, email_status, email_verified_at,
  contacts_enriched_at
) on public.leads to authenticated;

-- ---------------------------------------------------------------------------
-- 2. profiles: users cannot grant themselves a plan or a role
--
-- "users manage own profile" is FOR ALL, so a user could update their own row's
-- plan_id to a paid plan, role to 'admin', or reset leads_used to zero. Signup
-- legitimately writes email, full_name and terms_accepted_at, so this guards the
-- billing and privilege columns rather than dropping the policy.
--
-- Requests from the REST API run as the anon or authenticated role. The
-- payment webhook (service role), security definer functions and the SQL editor
-- run as other roles and are unaffected.
-- ---------------------------------------------------------------------------

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- A client-created profile always starts on the defaults.
    new.plan_id                := 'free';
    new.role                   := 'rep';
    new.leads_used             := 0;
    new.stripe_customer_id     := null;
    new.stripe_subscription_id := null;
    return new;
  end if;

  if new.plan_id                is distinct from old.plan_id
  or new.role                   is distinct from old.role
  or new.leads_used             is distinct from old.leads_used
  or new.stripe_customer_id     is distinct from old.stripe_customer_id
  or new.stripe_subscription_id is distinct from old.stripe_subscription_id then
    raise exception 'plan, role and usage can only be changed by the server'
      using errcode = '42501';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_profile_privileged_columns on public.profiles;
create trigger guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

-- ---------------------------------------------------------------------------
-- 3. daily_summaries: notifier only
--
-- Each payload holds the day's leads with full email and phone, and the "Users
-- read own summaries" policy exposed them unmasked. Nothing in the app reads
-- this table; the nightly job and a future notifier use the service role.
-- ---------------------------------------------------------------------------

drop policy if exists "Users read own summaries" on public.daily_summaries;
revoke all on public.daily_summaries from anon, authenticated;

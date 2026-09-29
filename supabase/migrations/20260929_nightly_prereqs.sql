-- 2026-09-29 — The pieces of 20260813_recent_searches_and_cron.sql that never
-- reached production.
--
-- daily-scrape reads recent_searches and writes daily_summaries via
-- daily_lead_summary(). None of the three existed on the live project, so the
-- first manual trigger of the nightly run returned 500. That migration's cron
-- section is deliberately NOT repeated: 20260926_daily_runs_and_contacts.sql
-- owns the schedule now, and the old '0 21 * * *' job would run beside it.
--
-- Two holes in the original are closed here:
--   * recent_searches was granted to authenticated. Views run as their owner and
--     skip RLS, so any signed-in user could list every account's searches.
--   * daily_lead_summary is security definer and takes a user id, so any
--     signed-in user could call it with someone else's id and read their leads.
-- Both are for the service role only; the dashboard never reads them.
--
-- Apply in the SQL editor, or:
--   npx supabase db query --linked -f supabase/migrations/20260929_nightly_prereqs.sql

create or replace view public.recent_searches as
select
  r.user_id,
  r.industry,
  r.city,
  max(r.created_at)                                   as last_run_at,
  count(*)                                            as run_count,
  coalesce(sum(r.leads_saved), 0)                     as leads_saved_total,
  coalesce(
    (array_agg(r.limit_requested order by r.created_at desc))[1],
    20
  )                                                   as last_limit
from scrape_runs r
where r.industry is not null
  and r.city is not null
group by r.user_id, r.industry, r.city
order by max(r.created_at) desc;

-- Supabase's default privileges grant new views to anon and authenticated.
revoke all on public.recent_searches from anon, authenticated;

create index if not exists idx_scrape_runs_user_created
  on scrape_runs (user_id, created_at desc);

create or replace function public.daily_lead_summary(
  p_user_id uuid,
  p_since   timestamptz default now() - interval '1 day',
  p_min_score int default 70
)
returns json as $$
  select json_build_object(
    'user_id',     p_user_id,
    'since',       p_since,
    'generated_at', now(),
    'new_count',   (select count(*) from leads
                     where user_id = p_user_id and created_at >= p_since),
    'high_count',  (select count(*) from leads
                     where user_id = p_user_id and created_at >= p_since
                       and score >= p_min_score),
    'leads', coalesce((
      select json_agg(row_to_json(t) order by t.score desc nulls last)
        from (
          select id, name, email, phone, website, industry, city,
                 score, summary, source, created_at
            from leads
           where user_id = p_user_id
             and created_at >= p_since
             and (score >= p_min_score or score is null)
           order by score desc nulls last
           limit 500
        ) t
    ), '[]'::json)
  );
$$ language sql stable security definer set search_path = public;

revoke execute on function public.daily_lead_summary(uuid, timestamptz, int) from public, anon, authenticated;

create table if not exists daily_summaries (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  new_count  int not null default 0,
  high_count int not null default 0,
  payload    jsonb not null,
  sent_at    timestamptz
);

create index if not exists idx_daily_summaries_unsent
  on daily_summaries (created_at) where sent_at is null;

alter table daily_summaries enable row level security;

drop policy if exists "Users read own summaries" on daily_summaries;
create policy "Users read own summaries" on daily_summaries
  for select using (auth.uid() = user_id);

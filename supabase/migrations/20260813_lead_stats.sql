-- 2026-08-13 — Server-side lead statistics
--
-- The stats bar was computed in the browser from the complete lead table, which
-- only worked because the dashboard downloaded every row. Once the table is
-- paginated the client only ever holds one page, so the aggregates have to come
-- from the database.
--
-- Takes no user_id parameter: it reads auth.uid() directly, so one account
-- cannot request another account's numbers by passing a different id.

create or replace function public.lead_stats()
returns json as $$
declare
  v_user uuid := auth.uid();
begin
  if v_user is null then
    return json_build_object('error', 'not authenticated');
  end if;

  return (
    select json_build_object(
      'total',      count(*),
      'new_today',  count(*) filter (
                      where (created_at at time zone 'Asia/Kolkata')::date
                          = (now()       at time zone 'Asia/Kolkata')::date
                    ),
      -- 70 is the canonical high-score threshold (src/constants/score.js) and
      -- is also what the daily high-score export uses.
      'high_score', count(*) filter (where score >= 70),
      'engaged',    count(*) filter (
                      where status in ('contacted', 'follow_up', 'qualified', 'converted')
                    ),
      -- Unscored leads are excluded rather than counted as zero, which would
      -- drag the average down and misrepresent lead quality.
      'unscored',   count(*) filter (where score is null),
      'avg_score',  coalesce(round(avg(score) filter (where score is not null)), 0)
    )
    from leads
    where user_id = v_user
  );
end;
$$ language plpgsql security definer stable;

-- Supports the "new today" and high-score counts without a sequential scan.
create index if not exists idx_leads_user_score_created
  on leads (user_id, score desc, created_at desc);

-- select public.lead_stats();

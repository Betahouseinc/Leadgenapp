-- 2026-08-13 — Roles and contact masking
--
-- Free-plan users see email and phone partially masked; paid plans and admins
-- see them in full.
--
-- Masking is done by a view rather than in React. The anon key is public and
-- the REST API is reachable directly, so UI-only masking is an upsell prompt,
-- not a control — anyone could curl the table and read every address.
--
-- The view carries its own `user_id = auth.uid()` filter. Views run as their
-- owner, so the RLS policy on `leads` does not apply through them and that
-- filter is what keeps accounts separated. Do not remove it.

-- ---------------------------------------------------------------------------
-- 1. Role
-- ---------------------------------------------------------------------------

alter table profiles add column if not exists role text not null default 'rep';

do $$
begin
  alter table profiles add constraint profiles_role_check check (role in ('admin', 'rep'));
exception when duplicate_object then null;
end $$;

-- Promote an admin by hand — there is deliberately no self-service path:
--   update profiles set role = 'admin' where email = 'you@exommerce.online';

-- ---------------------------------------------------------------------------
-- 2. Masking helpers
-- ---------------------------------------------------------------------------

create or replace function public.mask_email(v text)
returns text as $$
  select case
    when coalesce(v, '') = '' then v
    when position('@' in v) = 0 then '•••'
    else left(v, 1) || '•••@' || split_part(v, '@', 2)
  end;
$$ language sql immutable;

create or replace function public.mask_phone(v text)
returns text as $$
  select case
    when coalesce(v, '') = '' then v
    else '••••••' || right(regexp_replace(v, '\D', '', 'g'), 2)
  end;
$$ language sql immutable;

-- Admins always see contacts. Everyone else needs a paid plan.
create or replace function public.can_see_contacts()
returns boolean as $$
  select coalesce(
    (select p.role = 'admin' or coalesce(p.plan_id, 'free') <> 'free'
       from profiles p where p.id = auth.uid()),
    false
  );
$$ language sql stable security definer;

-- ---------------------------------------------------------------------------
-- 3. The view the dashboard reads
--
-- Writes (status, notes) still go to `leads` directly, where RLS applies as
-- before. This view is read-only by design.
-- ---------------------------------------------------------------------------

-- The dashboard and the lead drawer both read `company`, but nothing ever
-- writes it — the scraper only sets `name`. Added idempotently so the view
-- below cannot fail on a column that was only ever assumed to exist.
alter table leads add column if not exists company text;

create or replace view public.leads_view as
select
  l.id, l.user_id, l.name, l.company, l.website, l.address,
  l.industry, l.city, l.source, l.score, l.summary, l.status,
  l.notes, l.last_contacted_at, l.created_at, l.rating, l.review_count,
  case when public.can_see_contacts() then l.email else public.mask_email(l.email) end as email,
  case when public.can_see_contacts() then l.phone else public.mask_phone(l.phone) end as phone,
  not public.can_see_contacts() as contacts_masked
from leads l
where l.user_id = auth.uid();

grant select on public.leads_view to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Stats respect the same boundary
--
-- lead_stats() is security definer, so it must scope to auth.uid() itself.
-- Already does; nothing to change here. Noted so the next person does not add
-- an unscoped aggregate by mistake.
-- ---------------------------------------------------------------------------

-- select public.can_see_contacts();
-- select email, phone, contacts_masked from leads_view limit 5;

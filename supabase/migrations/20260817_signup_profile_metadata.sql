-- 2026-08-17 — Signup writes the profile from auth metadata
--
-- Signup collected a full name and a compliance acceptance, then tried to store
-- them with a client-side `profiles` upsert immediately after `auth.signUp`.
-- That write could never succeed: email confirmation is on for this project
-- (`mailer_autoconfirm: false`), so signUp returns a user but no session, and
-- the upsert therefore ran as `anon` and was refused by RLS. Its error was not
-- checked, so the failure was silent — no user has ever had a `full_name` or a
-- recorded `terms_accepted_at`.
--
-- The fix moves the write to where it cannot fail: the client passes both
-- values in `options.data`, GoTrue persists them to `auth.users.raw_user_meta_data`
-- as part of creating the user, and the existing on_auth_user_created trigger
-- copies them into `profiles`. No session is required at any point.

-- ---------------------------------------------------------------------------
-- 1. The column the frontend has been writing to all along
--
-- Never created by any migration. Leads.jsx reads `profile.full_name`, so the
-- dashboard has been falling back to the email initial for every user.
-- ---------------------------------------------------------------------------

alter table profiles add column if not exists full_name text;

-- ---------------------------------------------------------------------------
-- 2. Trigger reads the metadata GoTrue just wrote
--
-- The timestamptz cast is guarded. raw_user_meta_data is attacker-controlled —
-- anyone can post any JSON to /auth/v1/signup — and an uncaught cast error in
-- an AFTER INSERT trigger aborts the whole transaction, which would turn a
-- malformed value into "Database error saving new user" for that request.
-- A bad timestamp must cost the timestamp, not the account.
--
-- `set search_path` pins resolution for a security definer function so it
-- cannot be redirected by a caller-controlled search_path.
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger as $$
declare
  v_accepted timestamptz;
begin
  begin
    v_accepted := nullif(new.raw_user_meta_data->>'terms_accepted_at', '')::timestamptz;
  exception when others then
    v_accepted := null;
  end;

  insert into public.profiles (id, email, plan_id, leads_used, full_name, terms_accepted_at)
  values (
    new.id,
    new.email,
    'free',
    0,
    nullif(new.raw_user_meta_data->>'full_name', ''),
    v_accepted
  )
  on conflict (id) do nothing;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger definition is unchanged; recreated so this file stands alone.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- 3. Backfill existing users
--
-- The old signup code did pass `full_name` in options.data, so GoTrue stored it
-- even though the profiles upsert failed — those names are recoverable.
--
-- `terms_accepted_at` is not: it was only ever sent in the upsert that failed,
-- never in the metadata. It stays null for everyone who signed up before this
-- migration. Those users have accepted the compliance statement in the UI but
-- the acceptance was never recorded; re-prompting them is a product decision,
-- not something this migration should invent.
-- ---------------------------------------------------------------------------

update profiles p
set full_name = nullif(u.raw_user_meta_data->>'full_name', '')
from auth.users u
where u.id = p.id
  and p.full_name is null
  and nullif(u.raw_user_meta_data->>'full_name', '') is not null;

-- Verify:
--   select id, email, full_name, terms_accepted_at from profiles order by id;

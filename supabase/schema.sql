-- WorkoutTracker: friends and competition.
-- Paste this whole file into Supabase > SQL Editor > New query, and click Run.
-- It is safe to run more than once.
--
-- Privacy model: your full workout log NEVER leaves your phone. Only these go online:
--   * your display name and invite code (profiles)
--   * a weekly summary: workouts, kilos lifted, week streak (weekly_stats),
--     and only while "Share my stats" is on
--   * plans you choose to send to a friend (shared_plans)
--   * challenges (challenges)
-- Row-level security means people can only read rows they are allowed to.

-- ---------- Tables ----------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Lifter',
  invite_code text not null unique,
  share_stats boolean not null default true,
  created_at timestamptz not null default now()
);

-- One row per direction: (me, friend). Both rows are created together.
create table if not exists public.friendships (
  user_id uuid not null references public.profiles (id) on delete cascade,
  friend_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create table if not exists public.weekly_stats (
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_start date not null,          -- the Monday
  workouts int not null default 0,
  volume_kg numeric not null default 0,
  streak_weeks int not null default 0,
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start)
);

create table if not exists public.shared_plans (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  name text not null,
  payload jsonb not null,            -- the plan's workouts and exercises
  created_at timestamptz not null default now()
);

create table if not exists public.challenges (
  id uuid primary key default gen_random_uuid(),
  from_id uuid not null references public.profiles (id) on delete cascade,
  to_id uuid not null references public.profiles (id) on delete cascade,
  metric text not null check (metric in ('workouts', 'volume', 'streak')),
  week_start date not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now(),
  check (from_id <> to_id)
);

-- ---------- Helpers ----------

create or replace function public.is_friend(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from friendships where user_id = a and friend_id = b);
$$;

-- New sign-ups get a profile with a random 6-character invite code.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare code text;
begin
  loop
    code := upper(substr(md5(random()::text), 1, 6));
    exit when not exists (select 1 from profiles where invite_code = code);
  end loop;
  insert into profiles (id, invite_code) values (new.id, code) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Redeem a friend's invite code: makes you friends both ways. Returns their name.
create or replace function public.add_friend_by_code(code text)
returns text language plpgsql security definer set search_path = public as $$
declare other profiles%rowtype;
begin
  select * into other from profiles where invite_code = upper(trim(code));
  if other.id is null then raise exception 'No one has that code'; end if;
  if other.id = auth.uid() then raise exception 'That is your own code'; end if;
  insert into friendships (user_id, friend_id) values (auth.uid(), other.id), (other.id, auth.uid())
    on conflict do nothing;
  return other.display_name;
end;
$$;

-- Unfriend (removes both directions).
create or replace function public.remove_friend(friend uuid)
returns void language sql security definer set search_path = public as $$
  delete from friendships
  where (user_id = auth.uid() and friend_id = friend) or (user_id = friend and friend_id = auth.uid());
$$;

-- ---------- Row-level security ----------

alter table public.profiles enable row level security;
alter table public.friendships enable row level security;
alter table public.weekly_stats enable row level security;
alter table public.shared_plans enable row level security;
alter table public.challenges enable row level security;

drop policy if exists "profiles: me and friends can read" on public.profiles;
create policy "profiles: me and friends can read" on public.profiles for select
  using (id = auth.uid() or public.is_friend(auth.uid(), id));
drop policy if exists "profiles: I can update mine" on public.profiles;
create policy "profiles: I can update mine" on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "friendships: I can read mine" on public.friendships;
create policy "friendships: I can read mine" on public.friendships for select
  using (user_id = auth.uid());
-- (Friendships are only created or removed through the functions above.)

drop policy if exists "stats: me, and friends if I share" on public.weekly_stats;
create policy "stats: me, and friends if I share" on public.weekly_stats for select
  using (
    user_id = auth.uid()
    or (public.is_friend(auth.uid(), user_id)
        and exists (select 1 from profiles p where p.id = user_id and p.share_stats))
  );
drop policy if exists "stats: I can write mine" on public.weekly_stats;
create policy "stats: I can write mine" on public.weekly_stats for insert
  with check (user_id = auth.uid());
drop policy if exists "stats: I can update mine" on public.weekly_stats;
create policy "stats: I can update mine" on public.weekly_stats for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists "stats: I can delete mine" on public.weekly_stats;
create policy "stats: I can delete mine" on public.weekly_stats for delete
  using (user_id = auth.uid());

drop policy if exists "plans: sender and recipient can read" on public.shared_plans;
create policy "plans: sender and recipient can read" on public.shared_plans for select
  using (owner_id = auth.uid() or recipient_id = auth.uid());
drop policy if exists "plans: I can send to a friend" on public.shared_plans;
create policy "plans: I can send to a friend" on public.shared_plans for insert
  with check (owner_id = auth.uid() and public.is_friend(auth.uid(), recipient_id));
drop policy if exists "plans: sender or recipient can delete" on public.shared_plans;
create policy "plans: sender or recipient can delete" on public.shared_plans for delete
  using (owner_id = auth.uid() or recipient_id = auth.uid());

drop policy if exists "challenges: both sides can read" on public.challenges;
create policy "challenges: both sides can read" on public.challenges for select
  using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists "challenges: I can challenge a friend" on public.challenges;
create policy "challenges: I can challenge a friend" on public.challenges for insert
  with check (from_id = auth.uid() and public.is_friend(auth.uid(), to_id) and status = 'pending');
drop policy if exists "challenges: recipient can answer" on public.challenges;
create policy "challenges: recipient can answer" on public.challenges for update
  using (to_id = auth.uid()) with check (to_id = auth.uid());
drop policy if exists "challenges: either side can delete" on public.challenges;
create policy "challenges: either side can delete" on public.challenges for delete
  using (from_id = auth.uid() or to_id = auth.uid());

-- Let signed-in users reach these tables at all (row-level security above still
-- decides WHICH rows). Signed-out visitors ("anon") get nothing.
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.friendships, public.weekly_stats, public.shared_plans, public.challenges
  to authenticated;
revoke all on
  public.profiles, public.friendships, public.weekly_stats, public.shared_plans, public.challenges
  from anon;

grant execute on function public.add_friend_by_code(text) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;

-- ========================================================
-- GOLDENFELT CASINO: MULTI-DEVICE GLOBAL SYNC SCHEMA
-- Copy and paste this entire file into your Supabase SQL Editor
-- (Dashboard -> SQL Editor -> New Query -> Run)
-- ========================================================

-- 1. Create table for global players and live leaderboard
create table if not exists public.casino_players (
  player_id text primary key,
  name text not null,
  nametag_id text default 'tag-guest',
  balance bigint default 5000,
  total_won bigint default 0,
  total_lost bigint default 0,
  hands_played bigint default 0,
  total_bet bigint default 0,
  properties_count int default 0,
  is_club_member boolean default false,
  updated_at timestamp with time zone default now()
);

-- Ensure no 2 accounts with the same name can exist (case-insensitive)
create unique index if not exists casino_players_name_lower_idx on public.casino_players (lower(name));

-- One-time wealth reduction: reduce accounts over 8M to 8M (players can build it back up)
update public.casino_players set balance = 8000000 where balance > 8000000;

-- One-time property seizure: reset properties count to 0 (seized by the state)
update public.casino_players set properties_count = 0;

-- 2. Create table for casino stake pool investors
create table if not exists public.casino_stake_investors (
  player_id text primary key,
  player_name text not null,
  chips_invested bigint default 0,
  updated_at timestamp with time zone default now()
);

-- One-time casino stake pool seizure: wipe all legacy investor stonks to 0 ("seized by the state")
truncate table public.casino_stake_investors;

-- 3. Create table for VIP Club Hall of Fame
create table if not exists public.casino_club_members (
  name text primary key,
  title text default 'High Roller Founder',
  joined_at timestamp with time zone default now()
);

-- ========================================================
-- ENABLE ROW LEVEL SECURITY (RLS) & PUBLIC ACCESS POLICIES
-- ========================================================

alter table public.casino_players enable row level security;
alter table public.casino_stake_investors enable row level security;
alter table public.casino_club_members enable row level security;

-- Drop existing policies first so this script can be re-run safely at any time
drop policy if exists "Allow public read casino_players" on public.casino_players;
drop policy if exists "Allow public insert/update casino_players" on public.casino_players;
drop policy if exists "Allow public read casino_stake_investors" on public.casino_stake_investors;
drop policy if exists "Allow public insert/update casino_stake_investors" on public.casino_stake_investors;
drop policy if exists "Allow public read casino_club_members" on public.casino_club_members;
drop policy if exists "Allow public insert/update casino_club_members" on public.casino_club_members;

-- Allow anyone (public/anon) to read and upsert their rankings & stakes
create policy "Allow public read casino_players"
  on public.casino_players for select using (true);

create policy "Allow public insert/update casino_players"
  on public.casino_players for all using (true) with check (true);

create policy "Allow public read casino_stake_investors"
  on public.casino_stake_investors for select using (true);

create policy "Allow public insert/update casino_stake_investors"
  on public.casino_stake_investors for all using (true) with check (true);

create policy "Allow public read casino_club_members"
  on public.casino_club_members for select using (true);

create policy "Allow public insert/update casino_club_members"
  on public.casino_club_members for all using (true) with check (true);

-- Enable Realtime safely (only adds tables if not already in the publication)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casino_players'
  ) then
    alter publication supabase_realtime add table public.casino_players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casino_stake_investors'
  ) then
    alter publication supabase_realtime add table public.casino_stake_investors;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casino_club_members'
  ) then
    alter publication supabase_realtime add table public.casino_club_members;
  end if;
end $$;


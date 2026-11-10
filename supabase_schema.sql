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

-- 2. Create table for casino stake pool investors
create table if not exists public.casino_stake_investors (
  player_id text primary key,
  player_name text not null,
  chips_invested bigint default 0,
  updated_at timestamp with time zone default now()
);

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

-- Enable Realtime for live updates (optional, for instant subscriptions)
alter publication supabase_realtime add table public.casino_players;
alter publication supabase_realtime add table public.casino_stake_investors;
alter publication supabase_realtime add table public.casino_club_members;


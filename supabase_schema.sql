-- ========================================================
-- GOLDEN FELT CASINO: COMPLETE RESET & CLEAN INSTALL SCHEMA
-- Run this in your Supabase SQL Editor:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ========================================================

-- Enable cryptographic functions for secure bcrypt password hashing
create extension if not exists pgcrypto;

-- 0. Clean reset: remove previous/legacy tables, views, and schemas
drop function if exists public.spin_loot_box() cascade;
drop function if exists public.spin_loot_box(text) cascade;
drop function if exists public.spin_loot_box(text, bigint) cascade;
drop function if exists public.stake_tokens(bigint) cascade;
drop function if exists public.stake_tokens(bigint, text) cascade;
drop function if exists public.get_stake_pool() cascade;
drop function if exists public.claim_daily_token_spin() cascade;
drop function if exists public.claim_daily_token_spin(text) cascade;
drop function if exists public.buy_casino(text) cascade;
drop function if exists public.buy_casino(text, text) cascade;
drop function if exists public.record_game_hand(boolean, text) cascade;
drop function if exists public.record_game_hand(boolean, text, text) cascade;
drop function if exists public.buy_token_shop_item(text, int, text, int) cascade;
drop function if exists public.buy_token_shop_item(text, int, text, int, text) cascade;
drop function if exists public.redeem_grant(text, text) cascade;
drop function if exists public.redeem_grant(text, text, text) cascade;
drop function if exists public.sync_player_chips(bigint) cascade;
drop function if exists public.sync_player_chips(bigint, text) cascade;
drop function if exists public.sync_player_chips(bigint, text, bigint) cascade;
drop function if exists public.get_grant_roles() cascade;

drop table if exists public.casinos cascade;
drop table if exists public.players cascade;
drop table if exists public.stake_investors cascade;
drop table if exists public.club_members cascade;
drop table if exists public.leaderboard cascade;
drop schema if exists private cascade;

-- 1. Create public tables
create table if not exists public.players (
  id uuid primary key default coalesce(auth.uid(), gen_random_uuid()),
  name text not null,
  chips bigint not null default 5000 check (chips >= 0),
  tokens bigint not null default 0 check (tokens >= 0),
  nametag text not null default 'tag-guest',
  badge text default null,
  bet_tier int not null default 0 check (bet_tier >= 0 and bet_tier <= 3),
  blackjack_poker_streak int not null default 0,
  total_spins int not null default 0,
  last_token_spin_at timestamptz default null,
  last_luck_drop_at timestamptz default null,
  updated_at timestamptz default now()
);

create index if not exists players_name_lower_idx on public.players (lower(name));

create table if not exists public.casinos (
  id text primary key,
  name text not null,
  tagline text not null,
  icon text not null,
  price bigint not null check (price > 0),
  slot_num int not null default 1,
  currency text not null default 'chips',
  owner_id uuid references public.players(id) on delete set null,
  updated_at timestamptz default now()
);

-- Seed initial casino venues (Slots 1-4 = Chips, Slots 5-8 = Tokens)
insert into public.casinos (id, name, tagline, icon, price, slot_num, currency) values
  ('casino-studio', 'Downtown Studio Casino', 'Compact downtown venue with constant foot traffic', '🏢', 150000, 1, 'chips'),
  ('casino-underground', 'Underground Poker Den', 'Exclusive late-night speakeasy for card sharks', '🃏', 500000, 2, 'chips'),
  ('casino-strip-bar', 'Strip Casino Bar & Lounge', 'High-energy lounge right on the central boulevard', '🍸', 1200000, 3, 'chips'),
  ('casino-mall', 'Galleria Luxury Casino', 'Multi-level gaming pavilion in the high-end shopping district', '🛍️', 3000000, 4, 'chips'),
  ('casino-marina', 'Superyacht Harbor & Marina', 'Private deep-water dock accommodating billionaire yachts', '🛥️', 5000, 5, 'tokens'),
  ('casino-resort', '5-Star Casino Resort Hotel', '500-room luxury palace with VIP gaming suites', '🏨', 10000, 6, 'tokens'),
  ('casino-high-roller', 'High Roller Penthouse Casino', 'Top-floor panoramic venue exclusively for apex whales', '🏙️', 25000, 7, 'tokens'),
  ('casino-golden-felt', 'The Golden Felt Sovereign Casino', 'The ultimate crown jewel of high-stakes play', '👑', 50000, 8, 'tokens')
on conflict (id) do update set
  name = excluded.name,
  tagline = excluded.tagline,
  icon = excluded.icon,
  price = excluded.price,
  slot_num = excluded.slot_num,
  currency = excluded.currency,
  owner_id = null;

-- Central Token Stake Pool (Community Ownership - Empty at start, populated by real players)
create table if not exists public.stake_investors (
  id uuid primary key default coalesce(auth.uid(), gen_random_uuid()),
  player_name text not null,
  tokens_staked bigint not null default 0 check (tokens_staked >= 0),
  title text default 'Stakeholder',
  updated_at timestamptz default now()
);

create index if not exists stake_investors_name_idx on public.stake_investors (lower(player_name));

-- Clean reset of any dummy stake investors
truncate table public.stake_investors;

-- 2. Private schema and tables for role grants and rate limits
create schema if not exists private;

create table if not exists private.grant_configs (
  role_name text primary key,
  title text not null,
  grant_chips bigint not null,
  password_hash text not null,
  claimed_by uuid default null,
  claimed_at timestamptz
);

create table if not exists private.grant_attempts (
  user_id uuid primary key,
  failed_count int not null default 0,
  locked_until timestamptz default null,
  last_attempt_at timestamptz default now()
);

-- Seed role grants with the exact passwords requested:
-- Toby, Nik, Ethan, George, Abhay -> bigjeff1234!
-- Kiarash -> kfire2000!
-- johnsmith -> johnsmith4ever!
insert into private.grant_configs (role_name, title, grant_chips, password_hash) values
  ('Toby', 'Loyal Soldier', 500000, crypt('bigjeff1234!', gen_salt('bf'))),
  ('Nik', 'Loyal Soldier', 500000, crypt('bigjeff1234!', gen_salt('bf'))),
  ('Ethan', 'Loyal Soldier', 500000, crypt('bigjeff1234!', gen_salt('bf'))),
  ('George', 'Loyal Soldier', 500000, crypt('bigjeff1234!', gen_salt('bf'))),
  ('Abhay', 'Loyal Soldier', 500000, crypt('bigjeff1234!', gen_salt('bf'))),
  ('Kiarash', 'Great Guy', 10000000, crypt('kfire2000!', gen_salt('bf'))),
  ('johnsmith', 'Admin', 100000000, crypt('johnsmith4ever!', gen_salt('bf')))
on conflict (role_name) do update set
  title = excluded.title,
  grant_chips = excluded.grant_chips,
  password_hash = excluded.password_hash,
  claimed_by = null,
  claimed_at = null;

-- Reset any previous rate-limiting lockouts
delete from private.grant_attempts;

-- 3. RLS Policies
alter table public.players enable row level security;
alter table public.casinos enable row level security;
alter table public.stake_investors enable row level security;

create policy "Allow public read players"
  on public.players for select using (true);

create policy "Allow player insert own profile"
  on public.players for insert with check (auth.uid() = id or auth.uid() is null);

create policy "Allow player update own profile"
  on public.players for update using (auth.uid() = id or auth.uid() is null);

revoke update (chips, tokens, bet_tier, blackjack_poker_streak, total_spins, last_token_spin_at, last_luck_drop_at)
  on public.players from anon, authenticated;

create policy "Allow public read casinos"
  on public.casinos for select using (true);

create policy "Allow public read stake_investors"
  on public.stake_investors for select using (true);

create policy "Allow insert stake_investors"
  on public.stake_investors for insert with check (true);

create policy "Allow update stake_investors"
  on public.stake_investors for update using (true);

-- 4. Security Definer RPCs

-- 1. Buy Casino Venue Deed (Slots 1-4 = Chips, Slots 5-8 = Tokens)
create or replace function public.buy_casino(c_id text, p_player_name text default '')
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_casino public.casinos%rowtype;
  v_player public.players%rowtype;
  v_is_chip boolean;
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  -- Ensure player row exists
  insert into public.players (id, name, chips, tokens)
    values (v_uid, v_name, 5000, 0)
    on conflict (id) do nothing;

  -- Lock casino row
  select * into v_casino from public.casinos where id = c_id for update;
  if not found then
    return json_build_object('success', false, 'error', 'Casino does not exist.');
  end if;

  if v_casino.owner_id is not null then
    return json_build_object('success', false, 'error', 'This casino deed is already owned.');
  end if;

  -- Lock player row
  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player profile not found.');
  end if;

  v_is_chip := c_id in ('casino-studio', 'casino-underground', 'casino-strip-bar', 'casino-mall');

  if v_is_chip then
    -- Slots 1-4: Chips
    if v_player.chips < v_casino.price then
      return json_build_object('success', false, 'error', 'Insufficient chips. You need ' || (v_casino.price - v_player.chips)::text || ' more chips to buy this casino.');
    end if;

    update public.players
      set chips = chips - v_casino.price,
          updated_at = now()
      where id = v_uid;
  else
    -- Slots 5-8: Tokens
    if v_player.tokens < v_casino.price then
      return json_build_object('success', false, 'error', 'Insufficient tokens. You need ' || (v_casino.price - v_player.tokens)::text || ' more tokens to buy this casino.');
    end if;

    update public.players
      set tokens = tokens - v_casino.price,
          updated_at = now()
      where id = v_uid;
  end if;

  update public.casinos
    set owner_id = v_uid,
        updated_at = now()
    where id = c_id;

  return json_build_object(
    'success', true,
    'casino_id', c_id,
    'casino_name', v_casino.name,
    'price', v_casino.price,
    'currency', case when v_is_chip then 'chips' else 'tokens' end
  );
end;
$$;

-- 2. Spin Loot Box (10k chips. 10% 1-80 tokens, 5% 100-120 tokens, 2% 150+ tokens, 83% nothing)
create or replace function public.spin_loot_box(p_player_name text default '', p_client_chips bigint default null)
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_player public.players%rowtype;
  v_cost bigint := 10000;
  v_roll float;
  v_tokens_won int := 0;
  v_new_chips bigint;
  v_new_tokens bigint;
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips)
    values (v_uid, v_name, coalesce(p_client_chips, 5000))
    on conflict (id) do update set
      chips = case
        when p_client_chips is not null and p_client_chips >= 10000 and public.players.chips < 10000 then p_client_chips
        else public.players.chips
      end;

  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player not found.');
  end if;

  if v_player.chips < v_cost then
    if p_client_chips is not null and p_client_chips >= v_cost then
      v_player.chips := p_client_chips;
    else
      return json_build_object('success', false, 'error', 'Loot box costs 10,000 chips. Insufficient balance.');
    end if;
  end if;

  v_roll := random() * 100.0;

  if v_roll < 2.0 then
    -- 2% chance: 150+ tokens (150 - 250)
    v_tokens_won := floor(150 + random() * 101)::int;
  elsif v_roll < 7.0 then
    -- 5% chance: 100 - 120 tokens
    v_tokens_won := floor(100 + random() * 21)::int;
  elsif v_roll < 17.0 then
    -- 10% chance: 1 - 80 tokens
    v_tokens_won := floor(1 + random() * 80)::int;
  else
    -- 83% chance: the rest is nothing
    v_tokens_won := 0;
  end if;

  update public.players
    set chips = v_player.chips - v_cost,
        tokens = tokens + v_tokens_won,
        updated_at = now()
    where id = v_uid
    returning chips, tokens into v_new_chips, v_new_tokens;

  return json_build_object(
    'success', true,
    'won', (v_tokens_won > 0),
    'tokens_won', v_tokens_won,
    'chips', v_new_chips,
    'tokens', v_new_tokens
  );
end;
$$;

-- Zero-argument overload for spin_loot_box
create or replace function public.spin_loot_box()
returns json
language sql
security definer
as $$
  select public.spin_loot_box('', null);
$$;

-- 1-argument overload for spin_loot_box (p_player_name)
create or replace function public.spin_loot_box(p_player_name text)
returns json
language sql
security definer
as $$
  select public.spin_loot_box(p_player_name, null);
$$;

-- 2b. Central Casino Token Stake Pool RPC (Stake tokens & get equity ownership)
create or replace function public.stake_tokens(p_tokens bigint, p_player_name text default '')
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_player public.players%rowtype;
  v_investor public.stake_investors%rowtype;
  v_total_pool bigint;
  v_my_staked bigint;
  v_my_percent float;
begin
  if p_tokens <= 0 then
    return json_build_object('success', false, 'error', 'Stake amount must be greater than zero.');
  end if;

  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips, tokens)
    values (v_uid, v_name, 5000, 0)
    on conflict (id) do nothing;

  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player not found.');
  end if;

  if v_player.tokens < p_tokens then
    return json_build_object('success', false, 'error', 'Insufficient tokens. You have ' || v_player.tokens::text || ' tokens available.');
  end if;

  -- Deduct tokens from player
  update public.players
    set tokens = tokens - p_tokens,
        updated_at = now()
    where id = v_uid;

  -- Upsert into stake_investors
  select * into v_investor from public.stake_investors where lower(player_name) = lower(v_name) for update;
  if found then
    update public.stake_investors
      set tokens_staked = tokens_staked + p_tokens,
          updated_at = now()
      where id = v_investor.id
      returning tokens_staked into v_my_staked;
  else
    insert into public.stake_investors (player_name, tokens_staked, title)
      values (v_name, p_tokens, 'Casino Stakeholder')
      returning tokens_staked into v_my_staked;
  end if;

  select coalesce(sum(tokens_staked), 0) into v_total_pool from public.stake_investors;
  v_my_percent := case when v_total_pool > 0 then (v_my_staked::float / v_total_pool::float) * 100.0 else 0.0 end;

  return json_build_object(
    'success', true,
    'tokens_staked', p_tokens,
    'my_total_staked', v_my_staked,
    'total_pool', v_total_pool,
    'percent_owned', round(v_my_percent::numeric, 2)
  );
end;
$$;

create or replace function public.stake_tokens(p_tokens bigint)
returns json
language sql
security definer
as $$
  select public.stake_tokens(p_tokens, '');
$$;

create or replace function public.get_stake_pool()
returns json
language plpgsql
security definer
as $$
declare
  v_total_pool bigint;
  v_investors json;
begin
  select coalesce(sum(tokens_staked), 0) into v_total_pool from public.stake_investors;
  select json_agg(t) into v_investors from (
    select id, player_name, tokens_staked, title, updated_at
    from public.stake_investors
    order by tokens_staked desc
  ) t;

  return json_build_object(
    'total_pool', v_total_pool,
    'investors', coalesce(v_investors, '[]'::json)
  );
end;
$$;

-- 3. Daily Token Spin (24h cooldown)
create or replace function public.claim_daily_token_spin(p_player_name text default '')
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_player public.players%rowtype;
  v_tokens_won int;
  v_new_tokens bigint;
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips)
    values (v_uid, v_name, 5000)
    on conflict (id) do nothing;

  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player not found.');
  end if;

  if v_player.last_token_spin_at is not null and now() - v_player.last_token_spin_at < interval '24 hours' then
    return json_build_object('success', false, 'error', 'Daily token spin is cooling down.');
  end if;

  v_tokens_won := floor(25 + random() * 50)::int;

  update public.players
    set tokens = tokens + v_tokens_won,
        last_token_spin_at = now(),
        updated_at = now()
    where id = v_uid
    returning tokens into v_new_tokens;

  return json_build_object(
    'success', true,
    'tokens_won', v_tokens_won,
    'tokens', v_new_tokens
  );
end;
$$;

-- Zero-argument overload for claim_daily_token_spin
create or replace function public.claim_daily_token_spin()
returns json
language sql
security definer
as $$
  select public.claim_daily_token_spin('');
$$;

-- 4. Record Game Hand & Progress (4-win streak, 50 spins milestone, luck drop)
create or replace function public.record_game_hand(p_won boolean, p_game text, p_player_name text default '')
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_player public.players%rowtype;
  v_tokens_awarded int := 0;
  v_new_streak int;
  v_streak_awarded boolean := false;
  v_milestone_awarded boolean := false;
  v_luck_drop boolean := false;
  v_new_spins int;
  v_new_tokens bigint;
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips)
    values (v_uid, v_name, 5000)
    on conflict (id) do nothing;

  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player not found.');
  end if;

  v_new_spins := v_player.total_spins + 1;
  v_new_streak := v_player.blackjack_poker_streak;

  if lower(p_game) in ('blackjack', 'poker') then
    if p_won then
      v_new_streak := v_new_streak + 1;
      if v_new_streak >= 4 then
        v_tokens_awarded := v_tokens_awarded + 50;
        v_streak_awarded := true;
        v_new_streak := 0;
      end if;
    else
      v_new_streak := 0;
    end if;
  end if;

  if v_new_spins % 50 = 0 then
    v_tokens_awarded := v_tokens_awarded + 20;
    v_milestone_awarded := true;
  end if;

  if random() < 0.005 and (v_player.last_luck_drop_at is null or now() - v_player.last_luck_drop_at > interval '1 hour') then
    v_tokens_awarded := v_tokens_awarded + 25;
    v_luck_drop := true;
  end if;

  update public.players
    set tokens = tokens + v_tokens_awarded,
        total_spins = v_new_spins,
        blackjack_poker_streak = v_new_streak,
        last_luck_drop_at = case when v_luck_drop then now() else last_luck_drop_at end,
        updated_at = now()
    where id = v_uid
    returning tokens into v_new_tokens;

  return json_build_object(
    'success', true,
    'tokens_awarded', v_tokens_awarded,
    'tokens', v_new_tokens,
    'streak', v_new_streak,
    'streak_completed', v_streak_awarded,
    'milestone_awarded', v_milestone_awarded,
    'luck_drop', v_luck_drop
  );
end;
$$;

-- 5. Buy Token Shop Item (Sequential unlocking)
create or replace function public.buy_token_shop_item(
  p_category text,
  p_tier int,
  p_item_id text,
  p_cost int,
  p_player_name text default ''
)
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
  v_player public.players%rowtype;
  v_new_tokens bigint;
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips)
    values (v_uid, v_name, 5000)
    on conflict (id) do nothing;

  select * into v_player from public.players where id = v_uid for update;
  if not found then
    return json_build_object('success', false, 'error', 'Player not found.');
  end if;

  if v_player.tokens < p_cost then
    return json_build_object('success', false, 'error', 'Insufficient tokens. You need ' || (p_cost - v_player.tokens)::text || ' more tokens.');
  end if;

  if p_category = 'bet_tier' then
    if v_player.bet_tier != (p_tier - 1) then
      return json_build_object('success', false, 'error', 'You must unlock the previous bet tier first.');
    end if;

    update public.players
      set tokens = tokens - p_cost,
          bet_tier = p_tier,
          updated_at = now()
      where id = v_uid
      returning tokens into v_new_tokens;

    return json_build_object('success', true, 'bet_tier', p_tier, 'tokens', v_new_tokens);

  elsif p_category = 'nametag' then
    update public.players
      set tokens = tokens - p_cost,
          nametag = p_item_id,
          updated_at = now()
      where id = v_uid
      returning tokens into v_new_tokens;

    return json_build_object('success', true, 'nametag', p_item_id, 'tokens', v_new_tokens);

  elsif p_category = 'badge' then
    update public.players
      set tokens = tokens - p_cost,
          badge = p_item_id,
          updated_at = now()
      where id = v_uid
      returning tokens into v_new_tokens;

    return json_build_object('success', true, 'badge', p_item_id, 'tokens', v_new_tokens);

  elsif p_category in ('felt', 'back') then
    update public.players
      set tokens = greatest(0, tokens - p_cost),
          updated_at = now()
      where id = v_uid
      returning tokens into v_new_tokens;

    return json_build_object('success', true, 'item_id', p_item_id, 'tokens', v_new_tokens);
  else
    return json_build_object('success', false, 'error', 'Invalid shop category.');
  end if;
end;
$$;

-- 6. Redeem Starting Grant with Rate-Limiting and bcrypt password check
create or replace function public.redeem_grant(p_role text, p_password text, p_player_name text default '')
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), trim(p_role), 'Player');
  v_cfg private.grant_configs%rowtype;
  v_attempt private.grant_attempts%rowtype;
  v_new_chips bigint;
begin
  -- Resolve ID from auth or fallback to deterministic UUID from player name
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  -- Check rate limiting
  select * into v_attempt from private.grant_attempts where user_id = v_uid;
  if found and v_attempt.locked_until is not null and v_attempt.locked_until > now() then
    return json_build_object('success', false, 'error', 'Too many failed attempts. Account temporarily locked for 5 minutes.');
  end if;

  -- Fetch role config
  select * into v_cfg from private.grant_configs where lower(role_name) = lower(trim(p_role)) for update;
  if not found then
    return json_build_object('success', false, 'error', 'Role grant profile not found.');
  end if;

  if v_cfg.claimed_by is not null then
    return json_build_object('success', false, 'error', 'This grant has already been claimed and cannot be redeemed again.');
  end if;

  -- Validate bcrypt password hash server-side
  if v_cfg.password_hash != crypt(p_password, v_cfg.password_hash) and
     v_cfg.password_hash != crypt(trim(p_password), v_cfg.password_hash) then
    insert into private.grant_attempts (user_id, failed_count, last_attempt_at, locked_until)
    values (v_uid, 1, now(), null)
    on conflict (user_id) do update set
      failed_count = private.grant_attempts.failed_count + 1,
      last_attempt_at = now(),
      locked_until = case when private.grant_attempts.failed_count + 1 >= 5 then now() + interval '5 minutes' else null end;

    return json_build_object('success', false, 'error', 'Incorrect password. Attempt logged.');
  end if;

  -- Success: reset failed attempts
  delete from private.grant_attempts where user_id = v_uid;

  -- Ensure player row exists in public.players
  insert into public.players (id, name, chips)
    values (v_uid, v_name, v_cfg.grant_chips)
    on conflict (id) do update set
      chips = public.players.chips + v_cfg.grant_chips,
      updated_at = now()
    returning chips into v_new_chips;

  -- Mark grant claimed
  update private.grant_configs
    set claimed_by = v_uid,
        claimed_at = now()
    where role_name = v_cfg.role_name;

  return json_build_object(
    'success', true,
    'role_name', v_cfg.role_name,
    'title', v_cfg.title,
    'chips', v_cfg.grant_chips
  );
end;
$$;

-- 7. Debounced chip & token sync RPC
create or replace function public.sync_player_chips(p_chips bigint, p_player_name text default '', p_tokens bigint default null)
returns json
language plpgsql
security definer
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := coalesce(nullif(trim(p_player_name), ''), 'Player');
begin
  if v_uid is null then
    v_uid := md5('golden-felt-player:' || lower(v_name))::uuid;
  end if;

  insert into public.players (id, name, chips, tokens)
    values (v_uid, v_name, greatest(0, p_chips), coalesce(p_tokens, 0))
    on conflict (id) do update set
      chips = greatest(0, p_chips),
      tokens = case when p_tokens is not null then p_tokens else public.players.tokens end,
      updated_at = now();

  return json_build_object('success', true);
end;
$$;

create or replace function public.sync_player_chips(p_chips bigint)
returns json
language sql
security definer
as $$
  select public.sync_player_chips(p_chips, '', null);
$$;

create or replace function public.sync_player_chips(p_chips bigint, p_player_name text)
returns json
language sql
security definer
as $$
  select public.sync_player_chips(p_chips, p_player_name, null);
$$;

-- 8. Public view of Roles & Grants
create or replace function public.get_grant_roles()
returns table (
  role_name text,
  title text,
  grant_chips bigint,
  is_claimed boolean
)
language sql
security definer
as $$
  select role_name, title, grant_chips, (claimed_by is not null) as is_claimed
  from private.grant_configs
  order by grant_chips asc;
$$;

-- 9. Enable Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'players'
  ) then
    alter publication supabase_realtime add table public.players;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'casinos'
  ) then
    alter publication supabase_realtime add table public.casinos;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'stake_investors'
  ) then
    alter publication supabase_realtime add table public.stake_investors;
  end if;
end $$;

-- 10. Explicit permissions for API roles
grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to anon, authenticated, service_role;
grant execute on all functions in schema public to anon, authenticated, service_role;

-- 11. Force PostgREST to reload schema cache immediately
notify pgrst, 'reload schema';

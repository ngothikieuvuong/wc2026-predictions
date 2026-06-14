-- World Cup 2026 family prediction game — database schema.
-- Run this in the Supabase SQL editor (Dashboard → SQL → New query).
-- No auth, no RLS — this is a private family game.

create extension if not exists "pgcrypto";

-- Matches
create table if not exists matches (
  id            uuid primary key default gen_random_uuid(),
  team1         text not null,
  team2         text not null,
  kickoff_time  timestamptz not null,
  home_score    int,
  away_score    int,
  status        text not null default 'upcoming', -- 'upcoming' | 'finished'
  created_at    timestamptz not null default now()
);

-- Predictions: one per player per match (enforced by unique index)
create table if not exists predictions (
  id              uuid primary key default gen_random_uuid(),
  player_name     text not null,
  match_id        uuid not null references matches(id) on delete cascade,
  predicted_home  int not null,
  predicted_away  int not null,
  created_at      timestamptz not null default now()
);

create unique index if not exists predictions_one_per_player_per_match
  on predictions (match_id, lower(player_name));

-- Rewards: one row per player per settled DAY (day-based payout).
-- pay_date = the day whose settlement produced this payout (YYYY-MM-DD, VN date).
-- match_id kept (nullable) for backward compatibility; not used by day-based logic.
create table if not exists rewards (
  id           uuid primary key default gen_random_uuid(),
  player_name  text not null,
  match_id     uuid references matches(id) on delete cascade,
  pay_date     text,
  amount       numeric not null,
  created_at   timestamptz not null default now()
);

-- Players roster (for the name dropdown so stats don't split on typos)
create table if not exists players (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);
create unique index if not exists players_name_unique on players (lower(name));

insert into players (name) values
  ('Chương'),('Vương'),('ba Hiến'),('ba Đức'),('Quốc'),('Linh'),('Ny'),('Ly'),('Trà')
on conflict do nothing;

-- Disable RLS so the public anon key can read/write (private game, no security).
alter table matches     disable row level security;
alter table predictions disable row level security;
alter table rewards     disable row level security;
alter table players     disable row level security;

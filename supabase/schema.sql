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
  is_open       boolean not null default false,   -- admin opened it for predictions
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

-- Settlement history: one row per "Chia quỹ" event, storing the cumulative
-- net per person (received − stake in resolved days) at that moment.
create table if not exists settlements (
  id            uuid primary key default gen_random_uuid(),
  created_at    timestamptz not null default now(),
  cum           jsonb not null,
  prev_rewards  jsonb, -- rewards snapshot before this settlement (for revert)
  detail        jsonb  -- the confirmed payout breakdown of this settlement
);

-- Reactions (emoji) on predictions. A person can place several different
-- emojis on one prediction, but not the same emoji twice (unique below).
-- player_name is chosen from the roster when reacting.
create table if not exists reactions (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid not null references predictions(id) on delete cascade,
  player_name    text not null,
  emoji          text not null,
  created_at     timestamptz not null default now()
);
create unique index if not exists reactions_one_per_player_emoji
  on reactions (prediction_id, lower(player_name), emoji);

-- Disable RLS so the public anon key can read/write (private game, no security).
alter table matches     disable row level security;
alter table predictions disable row level security;
alter table rewards     disable row level security;
alter table players     disable row level security;
alter table settlements disable row level security;
alter table reactions   disable row level security;

-- Key/value settings (e.g. stake = price per prediction; default 20000 if unset).
create table if not exists settings (key text primary key, value text);
alter table settings disable row level security;

-- Manual fund adjustments: admin "trích quỹ" (give pool money to a person:
-- player_name set) or "sửa quỹ treo" (general correction: player_name null).
-- amount = money taken OUT of the pool. Separate from settlement rewards so it
-- never affects the watermark / treo-capacity logic.
create table if not exists adjustments (
  id           uuid primary key default gen_random_uuid(),
  player_name  text,
  amount       numeric not null,
  note         text,
  created_at   timestamptz not null default now()
);
alter table adjustments disable row level security;

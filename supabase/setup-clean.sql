-- World Cup 2026 prediction game — FRESH-INSTANCE setup (clean roster).
-- For spinning up a SEPARATE game for another group: create a new Supabase
-- project, then paste & run this whole file in SQL Editor. It creates every
-- table + seeds the 72 group-stage matches, with NO preset player names
-- (the new group adds their own). Then point a new Vercel deploy at this DB.
-- No auth, no RLS — private game.

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

-- No preset roster — the new group adds their own names via "+ Người mới".
-- (Optional) seed names here, e.g.:
-- insert into players (name) values ('Tên A'),('Tên B') on conflict do nothing;

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


-- World Cup 2026 group-stage matches (72 trận). Kickoff in Vietnam time (UTC+7).
-- Run in Supabase SQL editor AFTER schema.sql. Safe to re-run only on an empty matches table.

insert into matches (team1, team2, kickoff_time, status) values
  ('Mexico', 'Nam Phi', '2026-06-12T01:00:00+07:00', 'upcoming'),
  ('Hàn Quốc', 'CH Séc', '2026-06-12T08:00:00+07:00', 'upcoming'),
  ('Canada', 'Bosnia & Herzegovina', '2026-06-13T02:00:00+07:00', 'upcoming'),
  ('Mỹ', 'Paraguay', '2026-06-13T08:00:00+07:00', 'upcoming'),
  ('Úc', 'Thổ Nhĩ Kỳ', '2026-06-13T14:00:00+07:00', 'upcoming'),
  ('Qatar', 'Thụy Sĩ', '2026-06-14T02:00:00+07:00', 'upcoming'),
  ('Brazil', 'Maroc', '2026-06-14T05:00:00+07:00', 'upcoming'),
  ('Haiti', 'Scotland', '2026-06-14T08:00:00+07:00', 'upcoming'),
  ('Đức', 'Curaçao', '2026-06-15T01:00:00+07:00', 'upcoming'),
  ('Hà Lan', 'Nhật Bản', '2026-06-15T04:00:00+07:00', 'upcoming'),
  ('Bờ Biển Ngà', 'Ecuador', '2026-06-15T07:00:00+07:00', 'upcoming'),
  ('Thụy Điển', 'Tunisia', '2026-06-15T10:00:00+07:00', 'upcoming'),
  ('Tây Ban Nha', 'Cape Verde', '2026-06-16T01:00:00+07:00', 'upcoming'),
  ('Ả Rập Xê Út', 'Uruguay', '2026-06-16T05:00:00+07:00', 'upcoming'),
  ('Bỉ', 'Ai Cập', '2026-06-16T05:00:00+07:00', 'upcoming'),
  ('Iran', 'New Zealand', '2026-06-16T08:00:00+07:00', 'upcoming'),
  ('Pháp', 'Senegal', '2026-06-17T02:00:00+07:00', 'upcoming'),
  ('Iraq', 'Na Uy', '2026-06-17T05:00:00+07:00', 'upcoming'),
  ('Argentina', 'Algeria', '2026-06-17T08:00:00+07:00', 'upcoming'),
  ('Áo', 'Jordan', '2026-06-17T14:00:00+07:00', 'upcoming'),
  ('Bồ Đào Nha', 'CHDC Congo', '2026-06-18T01:00:00+07:00', 'upcoming'),
  ('Anh', 'Croatia', '2026-06-18T04:00:00+07:00', 'upcoming'),
  ('Ghana', 'Panama', '2026-06-18T07:00:00+07:00', 'upcoming'),
  ('Uzbekistan', 'Colombia', '2026-06-18T10:00:00+07:00', 'upcoming'),
  ('CH Séc', 'Nam Phi', '2026-06-19T01:00:00+07:00', 'upcoming'),
  ('Thụy Sĩ', 'Bosnia & Herzegovina', '2026-06-19T05:00:00+07:00', 'upcoming'),
  ('Canada', 'Qatar', '2026-06-19T08:00:00+07:00', 'upcoming'),
  ('Mexico', 'Hàn Quốc', '2026-06-20T02:00:00+07:00', 'upcoming'),
  ('Mỹ', 'Úc', '2026-06-20T05:00:00+07:00', 'upcoming'),
  ('Hà Lan', 'Thụy Điển', '2026-06-21T01:00:00+07:00', 'upcoming'),
  ('Đức', 'Bờ Biển Ngà', '2026-06-21T04:00:00+07:00', 'upcoming'),
  ('Scotland', 'Maroc', '2026-06-21T05:00:00+07:00', 'upcoming'),
  ('Brazil', 'Haiti', '2026-06-21T08:00:00+07:00', 'upcoming'),
  ('Ecuador', 'Curaçao', '2026-06-21T08:00:00+07:00', 'upcoming'),
  ('Thổ Nhĩ Kỳ', 'Paraguay', '2026-06-21T10:00:00+07:00', 'upcoming'),
  ('Tunisia', 'Nhật Bản', '2026-06-21T12:00:00+07:00', 'upcoming'),
  ('Tây Ban Nha', 'Ả Rập Xê Út', '2026-06-22T01:00:00+07:00', 'upcoming'),
  ('Uruguay', 'Cape Verde', '2026-06-22T05:00:00+07:00', 'upcoming'),
  ('Bỉ', 'Iran', '2026-06-22T05:00:00+07:00', 'upcoming'),
  ('New Zealand', 'Ai Cập', '2026-06-22T11:00:00+07:00', 'upcoming'),
  ('Argentina', 'Áo', '2026-06-23T01:00:00+07:00', 'upcoming'),
  ('Pháp', 'Iraq', '2026-06-23T04:00:00+07:00', 'upcoming'),
  ('Na Uy', 'Senegal', '2026-06-23T07:00:00+07:00', 'upcoming'),
  ('Jordan', 'Algeria', '2026-06-23T10:00:00+07:00', 'upcoming'),
  ('Bồ Đào Nha', 'Uzbekistan', '2026-06-24T01:00:00+07:00', 'upcoming'),
  ('Anh', 'Ghana', '2026-06-24T04:00:00+07:00', 'upcoming'),
  ('Panama', 'Croatia', '2026-06-24T07:00:00+07:00', 'upcoming'),
  ('Colombia', 'CHDC Congo', '2026-06-24T09:00:00+07:00', 'upcoming'),
  ('Scotland', 'Brazil', '2026-06-25T05:00:00+07:00', 'upcoming'),
  ('Maroc', 'Haiti', '2026-06-25T05:00:00+07:00', 'upcoming'),
  ('Thụy Sĩ', 'Canada', '2026-06-25T08:00:00+07:00', 'upcoming'),
  ('Bosnia & Herzegovina', 'Qatar', '2026-06-25T08:00:00+07:00', 'upcoming'),
  ('CH Séc', 'Mexico', '2026-06-26T02:00:00+07:00', 'upcoming'),
  ('Nam Phi', 'Hàn Quốc', '2026-06-26T02:00:00+07:00', 'upcoming'),
  ('Curaçao', 'Bờ Biển Ngà', '2026-06-26T04:00:00+07:00', 'upcoming'),
  ('Ecuador', 'Đức', '2026-06-26T04:00:00+07:00', 'upcoming'),
  ('Nhật Bản', 'Thụy Điển', '2026-06-26T07:00:00+07:00', 'upcoming'),
  ('Tunisia', 'Hà Lan', '2026-06-26T07:00:00+07:00', 'upcoming'),
  ('Thổ Nhĩ Kỳ', 'Mỹ', '2026-06-26T10:00:00+07:00', 'upcoming'),
  ('Paraguay', 'Úc', '2026-06-26T10:00:00+07:00', 'upcoming'),
  ('Na Uy', 'Pháp', '2026-06-27T02:00:00+07:00', 'upcoming'),
  ('Senegal', 'Iraq', '2026-06-27T02:00:00+07:00', 'upcoming'),
  ('Cape Verde', 'Ả Rập Xê Út', '2026-06-27T07:00:00+07:00', 'upcoming'),
  ('Uruguay', 'Tây Ban Nha', '2026-06-27T09:00:00+07:00', 'upcoming'),
  ('Ai Cập', 'Iran', '2026-06-27T10:00:00+07:00', 'upcoming'),
  ('New Zealand', 'Bỉ', '2026-06-27T10:00:00+07:00', 'upcoming'),
  ('Panama', 'Anh', '2026-06-28T04:00:00+07:00', 'upcoming'),
  ('Croatia', 'Ghana', '2026-06-28T04:00:00+07:00', 'upcoming'),
  ('Colombia', 'Bồ Đào Nha', '2026-06-28T07:30:00+07:00', 'upcoming'),
  ('CHDC Congo', 'Uzbekistan', '2026-06-28T07:30:00+07:00', 'upcoming'),
  ('Algeria', 'Áo', '2026-06-28T10:00:00+07:00', 'upcoming'),
  ('Jordan', 'Argentina', '2026-06-28T10:00:00+07:00', 'upcoming');

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

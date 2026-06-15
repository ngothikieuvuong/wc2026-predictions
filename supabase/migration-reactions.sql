-- Migration: emoji reactions on predictions.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).
-- A person can place several different emojis on one prediction, but not the
-- same emoji twice.

create table if not exists reactions (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid not null references predictions(id) on delete cascade,
  player_name    text not null,
  emoji          text not null,
  created_at     timestamptz not null default now()
);

-- Allow many emojis per person; uniqueness is per (prediction, person, emoji).
drop index if exists reactions_one_per_player_per_pred;
create unique index if not exists reactions_one_per_player_emoji
  on reactions (prediction_id, lower(player_name), emoji);

alter table reactions disable row level security;

notify pgrst, 'reload schema';

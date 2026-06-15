-- Migration: add emoji reactions on predictions.
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query).

create table if not exists reactions (
  id             uuid primary key default gen_random_uuid(),
  prediction_id  uuid not null references predictions(id) on delete cascade,
  player_name    text not null,
  emoji          text not null,
  created_at     timestamptz not null default now()
);

create unique index if not exists reactions_one_per_player_per_pred
  on reactions (prediction_id, lower(player_name));

alter table reactions disable row level security;

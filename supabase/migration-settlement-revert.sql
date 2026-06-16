-- Migration: persistent revert of a settlement ("chốt sổ").
-- Stores the rewards snapshot taken right before each settlement so it can be
-- restored later (even after a page refresh). Run once in the SQL editor.

alter table settlements add column if not exists prev_rewards jsonb;

notify pgrst, 'reload schema';

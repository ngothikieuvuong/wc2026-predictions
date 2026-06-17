-- Migration: store each settlement's payout breakdown so Tổng kết can show the
-- CONFIRMED division (not the pending/projected one). Run once in the SQL editor.

alter table settlements add column if not exists detail jsonb;

notify pgrst, 'reload schema';

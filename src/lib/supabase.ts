import { createClient } from "@supabase/supabase-js";
import { createMockClient } from "./mockClient";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
// Accept either the legacy anon JWT (NEXT_PUBLIC_SUPABASE_ANON_KEY) or the new
// publishable key (NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, "sb_publishable_…").
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// DEMO mode: when Supabase isn't configured (or still has the placeholder URL),
// fall back to an in-memory mock client seeded with fake data so the UI is
// fully browsable without a backend. Set the env vars to use real Supabase.
export const DEMO = !url || !anonKey || url.includes("your-project");

// Single shared client. No auth — private family game.
export const supabase: any = DEMO
  ? createMockClient()
  : createClient(url!, anonKey!);

export const STAKE_VND = 20000; // each prediction adds 20,000 VND to the jackpot

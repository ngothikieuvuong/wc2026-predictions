import { supabase, STAKE_VND } from "./supabase";
import type { Match, Prediction, Reward } from "./types";

// Current jackpot = total stakes from all predictions − total rewards paid out.
// Carryover is automatic: unpaid matches leave the pool untouched.
export async function getJackpot(): Promise<number> {
  const [{ count }, { data: rewards }] = await Promise.all([
    supabase.from("predictions").select("*", { count: "exact", head: true }),
    supabase.from("rewards").select("amount"),
  ]);
  const collected = (count ?? 0) * STAKE_VND;
  const paid = (rewards ?? []).reduce(
    (s: number, r: { amount: number }) => s + Number(r.amount),
    0
  );
  return collected - paid;
}

export async function getNextMatch(): Promise<Match | null> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .gte("kickoff_time", new Date().toISOString())
    .order("kickoff_time", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Match) ?? null;
}

export async function getLatestWinner(): Promise<{
  player_name: string;
  amount: number;
  match: Match | null;
} | null> {
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const reward = data as Reward;

  const { data: match } = await supabase
    .from("matches")
    .select("*")
    .eq("id", reward.match_id)
    .maybeSingle();

  return {
    player_name: reward.player_name,
    amount: Number(reward.amount),
    match: (match as Match) ?? null,
  };
}

export async function getOpenMatches(): Promise<Match[]> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .order("kickoff_time", { ascending: true });
  return (data as Match[]) ?? [];
}

export async function getLeaderboard(): Promise<
  { player_name: string; wins: number; total: number }[]
> {
  const { data } = await supabase.from("rewards").select("player_name, amount");
  const rows = (data as Pick<Reward, "player_name" | "amount">[]) ?? [];

  const map = new Map<string, { player_name: string; wins: number; total: number }>();
  for (const r of rows) {
    const key = r.player_name.toLowerCase();
    const entry = map.get(key) ?? { player_name: r.player_name, wins: 0, total: 0 };
    entry.wins += 1;
    entry.total += Number(r.amount);
    map.set(key, entry);
  }

  return [...map.values()].sort((a, b) => b.total - a.total || b.wins - a.wins);
}

export type { Match, Prediction, Reward };

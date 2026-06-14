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
  pay_date: string | null;
} | null> {
  // Highest payout of the most recently settled day.
  const { data } = await supabase
    .from("rewards")
    .select("*")
    .order("pay_date", { ascending: false })
    .order("amount", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const reward = data as Reward & { pay_date: string | null };

  return {
    player_name: reward.player_name,
    amount: Number(reward.amount),
    pay_date: reward.pay_date ?? null,
  };
}

// Upcoming matches kicking off from now through the end of tomorrow (viewer's
// local day). Falls back to the single next match if nothing in that window.
export async function getUpcomingSoon(): Promise<Match[]> {
  const now = new Date();
  const endOfTomorrow = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    23,
    59,
    59,
    999
  );

  const { data } = await supabase
    .from("matches")
    .select("*")
    .eq("status", "upcoming")
    .gte("kickoff_time", now.toISOString())
    .lte("kickoff_time", endOfTomorrow.toISOString())
    .order("kickoff_time", { ascending: true });

  const list = (data as Match[]) ?? [];
  if (list.length > 0) return list;

  const next = await getNextMatch();
  return next ? [next] : [];
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

// All predictions grouped by match (for the "everyone's predictions" view).
// Only includes matches that have at least one prediction, newest match first.
export async function getPredictionsByMatch(): Promise<
  { match: Match; predictions: Prediction[] }[]
> {
  const [{ data: matches }, { data: preds }] = await Promise.all([
    supabase.from("matches").select("*").order("kickoff_time", { ascending: false }),
    supabase.from("predictions").select("*").order("created_at", { ascending: true }),
  ]);

  const byMatch = new Map<string, Prediction[]>();
  for (const p of (preds as Prediction[]) ?? []) {
    const list = byMatch.get(p.match_id) ?? [];
    list.push(p);
    byMatch.set(p.match_id, list);
  }

  return ((matches as Match[]) ?? [])
    .filter((m) => byMatch.has(m.id))
    .map((m) => ({ match: m, predictions: byMatch.get(m.id)! }));
}

// Roster of player names (for the predict dropdown), in the order added.
export async function getPlayers(): Promise<string[]> {
  const { data } = await supabase
    .from("players")
    .select("name")
    .order("created_at", { ascending: true });
  return ((data as { name: string }[]) ?? []).map((p) => p.name);
}

// Add a new name to the roster (ignores if it already exists).
export async function addPlayer(name: string): Promise<void> {
  await supabase.from("players").insert({ name: name.trim() });
}

// Per-player money stats: Chi (staked) vs Thu (received) → Lời/Lỗ (profit).
export async function getStats(): Promise<
  { name: string; chi: number; thu: number; loiLo: number }[]
> {
  const [{ data: players }, { data: preds }, { data: rewards }] = await Promise.all([
    supabase.from("players").select("name"),
    supabase.from("predictions").select("player_name"),
    supabase.from("rewards").select("player_name, amount"),
  ]);

  const chiByName = new Map<string, number>(); // count of predictions
  for (const p of (preds as { player_name: string }[]) ?? []) {
    chiByName.set(p.player_name, (chiByName.get(p.player_name) ?? 0) + 1);
  }
  const thuByName = new Map<string, number>();
  for (const r of (rewards as { player_name: string; amount: number }[]) ?? []) {
    thuByName.set(r.player_name, (thuByName.get(r.player_name) ?? 0) + Number(r.amount));
  }

  // Union of roster + anyone who has activity.
  const names = new Set<string>([
    ...((players as { name: string }[]) ?? []).map((p) => p.name),
    ...chiByName.keys(),
    ...thuByName.keys(),
  ]);

  return [...names]
    .map((name) => {
      const chi = (chiByName.get(name) ?? 0) * STAKE_VND;
      const thu = thuByName.get(name) ?? 0;
      return { name, chi, thu, loiLo: thu - chi };
    })
    .sort((a, b) => b.loiLo - a.loiLo);
}

export type { Match, Prediction, Reward };

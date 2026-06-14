import { supabase } from "./supabase";
import { getJackpot } from "./queries";
import type { Match, Prediction } from "./types";

export type CalcResult = {
  winners: string[];
  amountEach: number;
  jackpotUsed: number;
  carriedOver: boolean;
};

// Finalize a match: store the score, then split the whole current jackpot
// equally among everyone who nailed the exact score. No winner → carry over.
// Idempotent: re-running recomputes from scratch (old rewards are cleared first).
export async function calculateWinners(
  matchId: string,
  homeScore: number,
  awayScore: number
): Promise<CalcResult> {
  // 1. Save the final score + mark finished.
  const { error: upErr } = await supabase
    .from("matches")
    .update({ home_score: homeScore, away_score: awayScore, status: "finished" })
    .eq("id", matchId);
  if (upErr) throw upErr;

  // 2. Clear any previous payout for this match so recalculation is safe.
  const { error: delErr } = await supabase
    .from("rewards")
    .delete()
    .eq("match_id", matchId);
  if (delErr) throw delErr;

  // 3. Find exact-score predictions.
  const { data, error: predErr } = await supabase
    .from("predictions")
    .select("*")
    .eq("match_id", matchId)
    .eq("predicted_home", homeScore)
    .eq("predicted_away", awayScore);
  if (predErr) throw predErr;

  const preds = (data as Prediction[]) ?? [];

  // Dedup by name (one prediction per person per match anyway).
  const winners = [...new Map(preds.map((p) => [p.player_name.toLowerCase(), p.player_name])).values()];

  if (winners.length === 0) {
    return { winners: [], amountEach: 0, jackpotUsed: 0, carriedOver: true };
  }

  // 4. Jackpot now (old rewards already cleared) = everything still in the pot.
  const jackpot = await getJackpot();
  const amountEach = jackpot / winners.length;

  const { error: insErr } = await supabase.from("rewards").insert(
    winners.map((name) => ({
      player_name: name,
      match_id: matchId,
      amount: amountEach,
    }))
  );
  if (insErr) throw insErr;

  return { winners, amountEach, jackpotUsed: jackpot, carriedOver: false };
}

export async function getAllMatches(): Promise<Match[]> {
  const { data } = await supabase
    .from("matches")
    .select("*")
    .order("kickoff_time", { ascending: true });
  return (data as Match[]) ?? [];
}

export async function getPredictionCount(matchId: string): Promise<number> {
  const { count } = await supabase
    .from("predictions")
    .select("*", { count: "exact", head: true })
    .eq("match_id", matchId);
  return count ?? 0;
}

import type { MatchLive } from "./fifaLineup";

export async function getMatchLive(
  team1: string,
  team2: string
): Promise<MatchLive> {
  try {
    const res = await fetch(
      `/api/match-live?t1=${encodeURIComponent(team1)}&t2=${encodeURIComponent(team2)}`,
      { cache: "no-store" }
    );
    return (await res.json()) as MatchLive;
  } catch {
    return { found: false };
  }
}

export type { MatchLive } from "./fifaLineup";

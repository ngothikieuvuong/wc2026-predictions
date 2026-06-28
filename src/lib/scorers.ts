// Top scorers / assists, aggregated from each finished match's goal events
// (FIFA has no precomputed leaderboard for this season). Server-only; cached.

import { viTeam } from "./fifa";

const COMP = 17;
const SEASON = 285023;
const CAL_URL =
  `https://api.fifa.com/api/v3/calendar/matches?language=en&count=200` +
  `&idCompetition=${COMP}&idSeason=${SEASON}` +
  `&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z`;
const liveUrl = (stage: string, match: string) =>
  `https://api.fifa.com/api/v3/live/football/${COMP}/${SEASON}/${stage}/${match}?language=en`;
const UA = { "User-Agent": "Mozilla/5.0" };

export type Scorer = { name: string; team: string; goals: number; pens: number };
export type Assister = { name: string; team: string; assists: number };

const desc = (a: { Description?: string }[] | undefined) => a?.[0]?.Description ?? "";

async function jget(url: string, revalidate: number): Promise<any | null> {
  try {
    const r = await fetch(url, { headers: UA, next: { revalidate } });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function getTopScorers(): Promise<{
  scorers: Scorer[];
  assists: Assister[];
}> {
  const cal = await jget(CAL_URL, 600);
  const fin: any[] = (cal?.Results ?? []).filter(
    (m: any) => m.MatchStatus === 0 && m.IdStage && m.IdMatch
  );
  if (fin.length === 0) return { scorers: [], assists: [] };

  const goals = new Map<string, Scorer>();
  const assists = new Map<string, Assister>();

  // Fetch match feeds in small parallel batches (cached 30 min each).
  const CONC = 8;
  for (let i = 0; i < fin.length; i += CONC) {
    const datas = await Promise.all(
      fin.slice(i, i + CONC).map((m) => jget(liveUrl(m.IdStage, m.IdMatch), 1800))
    );
    for (const d of datas) {
      if (!d) continue;
      for (const side of [d.HomeTeam, d.AwayTeam]) {
        const team = side?.IdCountry ? viTeam(side.IdCountry) : "";
        const nameById = new Map<string, string>(
          (side?.Players ?? []).map((p: any) => [
            p.IdPlayer,
            desc(p.PlayerName) || desc(p.ShortName) || "?",
          ])
        );
        for (const g of side?.Goals ?? []) {
          if (g.Type === 3) continue; // own goal — not credited to a scorer
          const e =
            goals.get(g.IdPlayer) ??
            ({ name: nameById.get(g.IdPlayer) ?? "?", team, goals: 0, pens: 0 } as Scorer);
          e.goals++;
          if (g.Type === 1) e.pens++; // penalty
          goals.set(g.IdPlayer, e);
          if (g.IdAssistPlayer) {
            const a =
              assists.get(g.IdAssistPlayer) ??
              ({ name: nameById.get(g.IdAssistPlayer) ?? "?", team, assists: 0 } as Assister);
            a.assists++;
            assists.set(g.IdAssistPlayer, a);
          }
        }
      }
    }
  }

  const scorers = [...goals.values()]
    .sort((a, b) => b.goals - a.goals || b.pens - a.pens || a.name.localeCompare(b.name))
    .slice(0, 25);
  const assistList = [...assists.values()]
    .sort((a, b) => b.assists - a.assists || a.name.localeCompare(b.name))
    .slice(0, 25);
  return { scorers, assists: assistList };
}

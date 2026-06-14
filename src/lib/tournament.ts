// Tournament overview (group standings + knockout bracket) computed live from
// the FIFA API. Server-only — used by the /giai server component.

import { viTeam } from "./fifa";

const FIFA_URL =
  "https://api.fifa.com/api/v3/calendar/matches?language=en&count=200" +
  "&idCompetition=17&idSeason=285023" +
  "&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z";

export type StandingRow = {
  name: string;
  P: number;
  W: number;
  D: number;
  L: number;
  GF: number;
  GA: number;
  GD: number;
  Pts: number;
};

export type GroupTable = { name: string; rows: StandingRow[] };
export type BracketMatch = {
  date: string;
  home: string;
  away: string;
  hs: number | null;
  as: number | null;
  played: boolean;
};
export type BracketRound = { name: string; matches: BracketMatch[] };

export type Tournament = {
  groups: GroupTable[];
  rounds: BracketRound[];
  error?: string;
};

const KO_ROUNDS = [
  "Round of 32",
  "Round of 16",
  "Quarter-final",
  "Semi-final",
  "Play-off for third place",
  "Final",
];

const KO_VI: Record<string, string> = {
  "Round of 32": "Vòng 1/16",
  "Round of 16": "Vòng 1/8",
  "Quarter-final": "Tứ kết",
  "Semi-final": "Bán kết",
  "Play-off for third place": "Tranh hạng ba",
  Final: "Chung kết",
};

function newRow(name: string): StandingRow {
  return { name, P: 0, W: 0, D: 0, L: 0, GF: 0, GA: 0, GD: 0, Pts: 0 };
}

function applyResult(r: StandingRow, gf: number, ga: number) {
  r.P++;
  r.GF += gf;
  r.GA += ga;
  r.GD = r.GF - r.GA;
  if (gf > ga) {
    r.W++;
    r.Pts += 3;
  } else if (gf === ga) {
    r.D++;
    r.Pts += 1;
  } else {
    r.L++;
  }
}

export async function getTournament(): Promise<Tournament> {
  let matches: any[] = [];
  try {
    const res = await fetch(FIFA_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      next: { revalidate: 300 },
    });
    if (!res.ok) throw new Error(`FIFA API ${res.status}`);
    const json = await res.json();
    matches = json.Results ?? [];
  } catch (e) {
    return { groups: [], rounds: [], error: (e as Error).message };
  }

  const stageOf = (m: any) => m.StageName?.[0]?.Description as string | undefined;
  const groupOf = (m: any) => m.GroupName?.[0]?.Description as string | undefined;

  // --- Group standings ---
  const groupMap = new Map<string, Map<string, StandingRow>>();
  for (const m of matches) {
    if (stageOf(m) !== "First Stage") continue;
    const g = groupOf(m);
    const hc = m.Home?.IdCountry;
    const ac = m.Away?.IdCountry;
    if (!g || !hc || !ac) continue;

    if (!groupMap.has(g)) groupMap.set(g, new Map());
    const tbl = groupMap.get(g)!;
    if (!tbl.has(hc)) tbl.set(hc, newRow(viTeam(hc)));
    if (!tbl.has(ac)) tbl.set(ac, newRow(viTeam(ac)));

    if (m.MatchStatus === 0 && m.Home?.Score != null && m.Away?.Score != null) {
      applyResult(tbl.get(hc)!, m.Home.Score, m.Away.Score);
      applyResult(tbl.get(ac)!, m.Away.Score, m.Home.Score);
    }
  }

  const groups: GroupTable[] = [...groupMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, tbl]) => ({
      name,
      rows: [...tbl.values()].sort(
        (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name)
      ),
    }));

  // --- Knockout bracket ---
  const label = (side: any, placeholder: string | undefined) =>
    side?.IdCountry ? viTeam(side.IdCountry) : placeholder || "?";

  const rounds: BracketRound[] = KO_ROUNDS.map((r) => ({
    name: KO_VI[r] ?? r,
    matches: matches
      .filter((m) => stageOf(m) === r)
      .sort((a, b) => (a.Date < b.Date ? -1 : a.Date > b.Date ? 1 : 0))
      .map((m) => ({
        date: m.Date ?? "",
        home: label(m.Home, m.PlaceHolderA),
        away: label(m.Away, m.PlaceHolderB),
        hs: m.Home?.Score ?? null,
        as: m.Away?.Score ?? null,
        played: m.MatchStatus === 0,
      })),
  })).filter((r) => r.matches.length > 0);

  return { groups, rounds };
}

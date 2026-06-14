// Sync final scores from FIFA's public JSON API into our matches table.
// World Cup 2026 = competition 17, season 285023.
// We only FILL SCORES + mark finished — paying out winners stays manual (admin).

import { supabase } from "./supabase";
import type { Match } from "./types";

const FIFA_COMPETITION = "17";
const FIFA_SEASON = "285023"; // FIFA World Cup 2026

// FIFA 3-letter country code → our Vietnamese team name.
// Codes are stable; names/localizations are not, so we key on the code.
const CODE_TO_VI: Record<string, string> = {
  ALG: "Algeria",
  ARG: "Argentina",
  AUS: "Úc",
  AUT: "Áo",
  BEL: "Bỉ",
  BIH: "Bosnia & Herzegovina",
  BRA: "Brazil",
  CPV: "Cape Verde",
  CAN: "Canada",
  COL: "Colombia",
  COD: "CHDC Congo",
  CIV: "Bờ Biển Ngà",
  CRO: "Croatia",
  CUW: "Curaçao",
  CZE: "CH Séc",
  ECU: "Ecuador",
  EGY: "Ai Cập",
  ENG: "Anh",
  FRA: "Pháp",
  GER: "Đức",
  GHA: "Ghana",
  HAI: "Haiti",
  IRN: "Iran",
  IRQ: "Iraq",
  JPN: "Nhật Bản",
  JOR: "Jordan",
  KOR: "Hàn Quốc",
  MEX: "Mexico",
  MAR: "Maroc",
  NED: "Hà Lan",
  NZL: "New Zealand",
  NOR: "Na Uy",
  PAN: "Panama",
  PAR: "Paraguay",
  POR: "Bồ Đào Nha",
  QAT: "Qatar",
  KSA: "Ả Rập Xê Út",
  SCO: "Scotland",
  SEN: "Senegal",
  RSA: "Nam Phi",
  ESP: "Tây Ban Nha",
  SWE: "Thụy Điển",
  SUI: "Thụy Sĩ",
  TUN: "Tunisia",
  TUR: "Thổ Nhĩ Kỳ",
  URU: "Uruguay",
  USA: "Mỹ",
  UZB: "Uzbekistan",
};

type FifaMatch = {
  MatchStatus: number; // 0 = finished, 1 = scheduled, 3 = live
  Home?: { IdCountry?: string; Score?: number | null };
  Away?: { IdCountry?: string; Score?: number | null };
};

const pairKey = (a: string, b: string) =>
  [a.toLowerCase(), b.toLowerCase()].sort().join(" | ");

export type SyncResult = {
  fetched: number;
  updated: { team1: string; team2: string; home_score: number; away_score: number }[];
  skippedUnmatched: number;
};

export async function syncFifaResults(): Promise<SyncResult> {
  const url =
    `https://api.fifa.com/api/v3/calendar/matches?language=en&count=200` +
    `&idCompetition=${FIFA_COMPETITION}&idSeason=${FIFA_SEASON}` +
    `&from=2026-06-01T00:00:00Z&to=2026-07-31T00:00:00Z`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`FIFA API ${res.status}`);
  const json = await res.json();
  const results: FifaMatch[] = json.Results ?? [];

  // Only matches we haven't finalised yet — never clobber an already-finished match.
  const { data } = await supabase.from("matches").select("*").eq("status", "upcoming");
  const ours = (data as Match[]) ?? [];
  const lookup = new Map<string, Match>();
  for (const m of ours) lookup.set(pairKey(m.team1, m.team2), m);

  const updated: SyncResult["updated"] = [];
  let skippedUnmatched = 0;

  for (const fm of results) {
    if (fm.MatchStatus !== 0) continue; // not finished
    const hc = fm.Home?.IdCountry;
    const ac = fm.Away?.IdCountry;
    const hs = fm.Home?.Score;
    const as = fm.Away?.Score;
    if (hc == null || ac == null || hs == null || as == null) continue;

    const homeVI = CODE_TO_VI[hc];
    const awayVI = CODE_TO_VI[ac];
    if (!homeVI || !awayVI) continue;

    const m = lookup.get(pairKey(homeVI, awayVI));
    if (!m) {
      skippedUnmatched++;
      continue;
    }

    // Orient FIFA's home/away scores to OUR team1/team2 (predictions are made
    // against team1=home, team2=away as stored).
    const team1IsHome = m.team1.toLowerCase() === homeVI.toLowerCase();
    const home_score = team1IsHome ? hs : as;
    const away_score = team1IsHome ? as : hs;

    const { error } = await supabase
      .from("matches")
      .update({ home_score, away_score, status: "finished" })
      .eq("id", m.id)
      .eq("status", "upcoming"); // guard: don't overwrite a concurrent finalise
    if (!error) updated.push({ team1: m.team1, team2: m.team2, home_score, away_score });
  }

  return { fetched: results.length, updated, skippedUnmatched };
}

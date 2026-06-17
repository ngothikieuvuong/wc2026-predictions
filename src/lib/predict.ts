// A free, on-device statistical score hint — REFERENCE ONLY. Builds expected
// goals for each team, then a Poisson grid → most likely scoreline + outcome
// odds. Priority of signals:
//   1) bookmaker lines we already scrape (tài xỉu = expected total goals,
//      kèo chấp = goal supremacy) — the strongest signal,
//   2) else FIFA rank blended with this tournament's scoring form.
import { getTeamInfo } from "./queries";
import { getOdds, findOdds } from "./oddsClient";
import { teamRank } from "./strength";
import { normTeam } from "./odds";

export type Prediction = {
  teamA: string;
  teamB: string;
  scoreA: number;
  scoreB: number;
  lambdaA: number;
  lambdaB: number;
  pA: number; // P(A win)
  pDraw: number;
  pB: number; // P(B win)
  pTopScore: number; // probability of the single most likely scoreline
  top: { a: number; b: number; p: number }[];
  basis: string; // which signals drove it (shown to the user)
};

const fact = (n: number) => {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
};
const poisson = (l: number, k: number) =>
  (Math.exp(-l) * Math.pow(l, k)) / fact(k);

// "2.5/3" → 2.75 · "0.5" → 0.5 · "" → null
function parseLine(s: string | undefined): number | null {
  if (!s) return null;
  const ns = s
    .split("/")
    .map((x) => parseFloat(x.replace(/[^0-9.]/g, "")))
    .filter((n) => !isNaN(n));
  if (!ns.length) return null;
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

// Rank (1 = best) → a 0..1 strength; unknown teams get a modest default.
const rating = (rank: number | null) =>
  rank ? Math.min(0.99, Math.max(0.05, (100 - rank) / 100)) : 0.3;

export async function predictMatch(
  teamA: string,
  teamB: string
): Promise<Prediction> {
  const [info, oddsRows] = await Promise.all([
    getTeamInfo(teamA, teamB),
    getOdds(),
  ]);
  const A = info[0];
  const B = info[1];

  let lamA: number;
  let lamB: number;
  let basis: string;

  const odds = findOdds(oddsRows, teamA, teamB);
  const total = odds ? parseLine(odds.ouLine) : null;
  const supremacy = odds ? parseLine(odds.hcLine) : null;

  if (odds && total != null && supremacy != null && total > 0) {
    // Bookmaker-driven. The favourite (who gives the handicap) is taken from
    // FIFA rank; if ranks tie/unknown, fall back to the source's home side.
    const aIsHome = normTeam(teamA) === normTeam(odds.home);
    const favA =
      A.rank != null && B.rank != null && A.rank !== B.rank
        ? A.rank < B.rank
        : aIsHome;
    const D = favA ? supremacy : -supremacy; // expected (A − B) goal diff
    lamA = (total + D) / 2;
    lamB = (total - D) / 2;
    basis = "kèo nhà cái (tài xỉu + chấp)";
  } else {
    // Fallback: rank, blended with this tournament's scoring once both have
    // played at least one match.
    const MEAN = 1.3;
    lamA = MEAN * Math.exp(0.9 * (rating(A.rank) - rating(B.rank)));
    lamB = MEAN * Math.exp(0.9 * (rating(B.rank) - rating(A.rank)));
    if (A.played > 0 && B.played > 0) {
      const formA = (A.gf / A.played + B.ga / B.played) / 2;
      const formB = (B.gf / B.played + A.ga / A.played) / 2;
      lamA = 0.55 * lamA + 0.45 * formA;
      lamB = 0.55 * lamB + 0.45 * formB;
      basis = "rank FIFA + phong độ tại giải";
    } else {
      basis = "rank FIFA";
    }
  }

  lamA = Math.max(0.15, lamA);
  lamB = Math.max(0.15, lamB);

  const MAX = 6;
  const pa = Array.from({ length: MAX + 1 }, (_, i) => poisson(lamA, i));
  const pb = Array.from({ length: MAX + 1 }, (_, j) => poisson(lamB, j));
  const cells: { a: number; b: number; p: number }[] = [];
  let pAw = 0;
  let pD = 0;
  let pBw = 0;
  for (let i = 0; i <= MAX; i++)
    for (let j = 0; j <= MAX; j++) {
      const p = pa[i] * pb[j];
      cells.push({ a: i, b: j, p });
      if (i > j) pAw += p;
      else if (i === j) pD += p;
      else pBw += p;
    }
  cells.sort((x, y) => y.p - x.p);

  return {
    teamA,
    teamB,
    scoreA: cells[0].a,
    scoreB: cells[0].b,
    lambdaA: lamA,
    lambdaB: lamB,
    pA: pAw,
    pDraw: pD,
    pB: pBw,
    pTopScore: cells[0].p,
    top: cells.slice(0, 3),
    basis,
  };
}

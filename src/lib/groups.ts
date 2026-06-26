import { getGroupStandings } from "./queries";

type GroupTable = Awaited<ReturnType<typeof getGroupStandings>>[number];

// Group standings (from our match results), fetched once per page load.
let cache: Promise<GroupTable[]> | null = null;
export function getGroups(): Promise<GroupTable[]> {
  if (!cache) cache = getGroupStandings();
  return cache;
}
export function resetGroups(): void {
  cache = null;
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

export type GroupAnalysis = {
  group: string; // "A"
  pts: number;
  played: number;
  pos: number; // 1..4
  maxPts: number;
  verdict: "done-top2" | "third" | "out" | "secured" | "contention";
  label: string;
};

// Rank of a team among all groups' 3rd-placed teams (1 = best). WC2026: top 8
// of the 12 thirds advance. Points → GD → GF (tiebreaks approximated).
function thirdPlaceRank(
  groups: GroupTable[],
  team: string
): { rank: number; total: number } | null {
  const thirds = groups
    .map((g) => g.rows[2])
    .filter(Boolean)
    .sort(
      (a, b) => b.Pts - a.Pts || b.GD - a.GD || b.GF - a.GF || a.name.localeCompare(b.name)
    );
  const i = thirds.findIndex((r) => norm(r.name) === norm(team));
  return i < 0 ? null : { rank: i + 1, total: thirds.length };
}

// Where a team stands in its group + a SHORT, points-based read on its chances:
// chắc chắn hạng 1 / chắc chắn Top 2 / thắng trận này là chắc … / (nếu hạng 3)
// đang top x/8. Reference-only — tiebreakers are approximated. `opponent` is the
// other side in THIS match, so "thắng trận này" accounts for them dropping points.
export function groupStatus(
  groups: GroupTable[],
  team: string,
  opponent?: string
): GroupAnalysis | null {
  const t = norm(team);
  for (const g of groups) {
    const idx = g.rows.findIndex((r) => norm(r.name) === t);
    if (idx < 0) continue;
    const row = g.rows[idx];
    const remaining = Math.max(0, 3 - row.P);
    const maxPts = row.Pts + 3 * remaining;
    const others = g.rows.filter((_, i) => i !== idx);
    const winnable = (o: (typeof others)[number]) => Math.max(0, 3 - o.P);
    const oMax = (o: (typeof others)[number]) => o.Pts + 3 * winnable(o);
    // How many others can still finish strictly above `myMin` points.
    const aboveCount = (myMin: number, ceil = oMax) =>
      others.filter((o) => ceil(o) > myMin).length;
    const pos = idx + 1;
    const group = g.name.replace(/^Group\s*/i, "");

    let verdict: GroupAnalysis["verdict"];
    let label: string;

    const thirdLabel = (): { v: GroupAnalysis["verdict"]; l: string } => {
      const tr = thirdPlaceRank(groups, team);
      if (!tr) return { v: "third", l: "Hạng 3 — chờ xét vé vớt" };
      return tr.rank <= 8
        ? { v: "secured", l: `Hạng 3 — đang top ${tr.rank}/8, đi tiếp ✓` }
        : { v: "third", l: `Hạng 3 — thứ ${tr.rank}/${tr.total}, ngoài top 8` };
    };

    if (remaining === 0) {
      if (pos === 1) {
        verdict = "done-top2";
        label = "Chắc chắn nhất bảng (hạng 1) ✓";
      } else if (pos === 2) {
        verdict = "done-top2";
        label = "Chắc chắn nhì bảng (hạng 2) ✓";
      } else if (pos === 3) {
        ({ v: verdict, l: label } = thirdLabel());
      } else {
        verdict = "out";
        label = "Dừng ở vòng bảng";
      }
    } else if (aboveCount(row.Pts) === 0) {
      verdict = "done-top2";
      label = "Chắc chắn nhất bảng (hạng 1) ✓";
    } else if (aboveCount(row.Pts) <= 1) {
      verdict = "secured";
      label = "Chắc chắn vào Top 2 ✓";
    } else {
      // If this team WINS this match: +3 for them, the opponent loses a winnable.
      const minAfterWin = row.Pts + 3;
      const ceilAfterWin = (o: (typeof others)[number]) =>
        opponent && norm(o.name) === norm(opponent)
          ? o.Pts + 3 * Math.max(0, winnable(o) - 1)
          : oMax(o);
      const aboveAfterWin = aboveCount(minAfterWin, ceilAfterWin);
      if (aboveAfterWin === 0) {
        verdict = "contention";
        label = "Thắng trận này là chắc hạng 1 ✓";
      } else if (aboveAfterWin <= 1) {
        verdict = "contention";
        label = "Thắng trận này là chắc Top 2";
      } else if (pos === 3) {
        const tr = thirdPlaceRank(groups, team);
        verdict = tr && tr.rank <= 8 ? "secured" : "contention";
        label = tr ? `Đang hạng 3 — tạm top ${tr.rank}/8` : "Đang tranh vé hạng 3";
      } else {
        verdict = "contention";
        label = "Đang tranh vé Top 2";
      }
    }

    return { group, pts: row.Pts, played: row.P, pos, maxPts, verdict, label };
  }
  return null;
}

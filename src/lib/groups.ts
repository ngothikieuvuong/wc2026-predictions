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

// Where a team stands in its group + a (points-based, reference-only) read on
// its chances of finishing Top 2. Tiebreakers/best-third-place are ignored, so
// it's a guide, not gospel. WC2026: top 2 of each group + best thirds advance.
export function groupStatus(
  groups: GroupTable[],
  team: string
): GroupAnalysis | null {
  const t = norm(team);
  for (const g of groups) {
    const idx = g.rows.findIndex((r) => norm(r.name) === t);
    if (idx < 0) continue;
    const row = g.rows[idx];
    const remaining = Math.max(0, 3 - row.P);
    const maxPts = row.Pts + 3 * remaining;
    const others = g.rows.filter((_, i) => i !== idx);
    const oCeil = (o: (typeof others)[number]) => o.Pts + 3 * Math.max(0, 3 - o.P);
    const canBeAbove = others.filter((o) => oCeil(o) > row.Pts).length;
    const alreadyAbove = others.filter((o) => o.Pts > maxPts).length;
    const pos = idx + 1;
    const group = g.name.replace(/^Group\s*/i, "");

    let verdict: GroupAnalysis["verdict"];
    let label: string;
    if (remaining === 0) {
      if (pos <= 2) {
        verdict = "done-top2";
        label = "Đã vào vòng trong (Top 2) ✓";
      } else if (pos === 3) {
        verdict = "third";
        label = "Hạng 3 — chờ xét vé vớt";
      } else {
        verdict = "out";
        label = "Dừng ở vòng bảng";
      }
    } else if (canBeAbove <= 1) {
      verdict = "secured";
      label = "Gần như chắc Top 2 ✓";
    } else if (alreadyAbove >= 2) {
      verdict = "out";
      label = "Khó vào Top 2 (trông vào vé vớt hạng 3)";
    } else {
      verdict = "contention";
      let need: number | null = null;
      for (let x = 0; x <= 3 * remaining; x++) {
        if (others.filter((o) => oCeil(o) > row.Pts + x).length <= 1) {
          need = x;
          break;
        }
      }
      label =
        need != null && need > 0
          ? `Đang tranh vé — cần thêm ~${need}đ (còn ${remaining} trận)`
          : `Đang tranh vé Top 2 — còn ${remaining} trận`;
    }

    return { group, pts: row.Pts, played: row.P, pos, maxPts, verdict, label };
  }
  return null;
}

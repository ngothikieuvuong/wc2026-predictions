// Which "game day" a kickoff belongs to (Vietnam time, UTC+7).
// Rule: matches before 21:00 count as that day; 21:00 onwards count as the
// next day. Used for day-based settlement, fund-by-day, and home grouping.

const VN_OFFSET = 7 * 3600 * 1000;
export const DAY_CUTOFF_HOUR = 21;

export function dayKey(iso: string): string {
  const v = new Date(new Date(iso).getTime() + VN_OFFSET);
  if (v.getUTCHours() >= DAY_CUTOFF_HOUR) v.setUTCDate(v.getUTCDate() + 1);
  return v.toISOString().slice(0, 10); // YYYY-MM-DD
}

// "YYYY-MM-DD" → "DD/MM"
export function dayLabel(key: string): string {
  return `${key.slice(8, 10)}/${key.slice(5, 7)}`;
}

// The "active" game-day = earliest prediction-day whose matches aren't all
// finished. Days ≤ active count toward the current fund; later days don't yet.
// When a day finishes, the next day becomes active (no need to wait for 21h).
export function activeDay(
  matches: { id: string; kickoff_time: string; home_score: number | null; away_score: number | null }[],
  preds: { match_id: string }[]
): string {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const finished = new Map<string, boolean>(); // day → all predicted matches done
  for (const p of preds) {
    const m = byId.get(p.match_id);
    if (!m) continue;
    const d = dayKey(m.kickoff_time);
    const done = m.home_score != null && m.away_score != null;
    finished.set(d, (finished.get(d) ?? true) && done);
  }
  const days = [...finished.keys()].sort();
  if (days.length === 0) return "9999-99-99";
  for (const d of days) if (!finished.get(d)) return d;
  return days[days.length - 1];
}

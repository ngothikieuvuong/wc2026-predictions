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

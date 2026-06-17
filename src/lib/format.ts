export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "₫";
}

export function formatKickoff(iso: string): string {
  // Always show Vietnam time (UTC+7), regardless of the viewer's device.
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Short Vietnam-time stamp, e.g. "14:30 15/06" — used for prediction time.
export function formatShort(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });
}

export function isClosed(kickoff: string): boolean {
  return new Date(kickoff).getTime() <= Date.now();
}

// Stable anchor id for a match, order-free on the team pair. Used to link a
// match popup to its card on the "everyone's predictions" page.
export function matchSlug(team1: string, team2: string): string {
  const norm = (s: string) =>
    s
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]/g, "");
  return "match-" + [norm(team1), norm(team2)].sort().join("-");
}

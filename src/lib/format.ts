export function formatVND(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "₫";
}

export function formatKickoff(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function isClosed(kickoff: string): boolean {
  return new Date(kickoff).getTime() <= Date.now();
}

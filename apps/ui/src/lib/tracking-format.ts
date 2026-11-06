/** Local midnight to local midnight for a yyyy-mm-dd date. */
export function dayRange(date: string): { from: string; to: string } {
  const [y, m, d] = date.split("-").map(Number);
  return { from: new Date(y, m - 1, d).toISOString(), to: new Date(y, m - 1, d + 1).toISOString() };
}

export function toDateInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "45 min", "2 h 10 min", "3 days 4 h". */
export function duration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return minutes % 60 ? `${hours} h ${minutes % 60} min` : `${hours} h`;
  const days = Math.floor(hours / 24);
  return hours % 24 ? `${days} ${days === 1 ? "day" : "days"} ${hours % 24} h` : `${days} ${days === 1 ? "day" : "days"}`;
}

/** Start of the week (Monday) a date falls in. */
export function weekStart(date: Date): Date {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

export type ReportPeriod = "week" | "lastWeek" | "month" | "days30";

export function periodRange(period: ReportPeriod, now: Date): { from: string; to: string } {
  const to = now.toISOString();
  if (period === "week") return { from: weekStart(now).toISOString(), to };
  if (period === "lastWeek") {
    const end = weekStart(now);
    const start = new Date(end);
    start.setDate(start.getDate() - 7);
    return { from: start.toISOString(), to: end.toISOString() };
  }
  if (period === "month") return { from: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), to };
  return { from: new Date(now.getTime() - 30 * 86_400_000).toISOString(), to };
}

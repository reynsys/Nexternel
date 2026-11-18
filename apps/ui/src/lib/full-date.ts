/**
 * The one way Nexternel writes a moment in full: "Wednesday 18 November 2026, 10:37".
 * Never "Today" or "Yesterday": a screen left open, a screenshot or a wall display must still be right
 * tomorrow. Day and month names follow the screen's language; the order stays the same everywhere.
 */
export function fullDateTime(when: string | number | Date, locale?: string): string {
  return `${fullDate(when, locale)}, ${clockTime(when, locale)}`;
}

/** "Wednesday 18 November 2026". */
export function fullDate(when: string | number | Date, locale?: string): string {
  const d = new Date(when);
  const parts = new Intl.DateTimeFormat(locale, { weekday: "long", day: "numeric", month: "long", year: "numeric" }).formatToParts(d);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  return `${part("weekday")} ${part("day")} ${part("month")} ${part("year")}`;
}

/** "10:37". */
export function clockTime(when: string | number | Date, locale?: string): string {
  return new Date(when).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

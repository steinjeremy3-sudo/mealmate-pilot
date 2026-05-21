// Shared offer formatting — day-of-week and time-window labels.
// Used by the offer detail page, claim flow, and the diner cards.

const ORDER = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const FULL: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

const SHORT: Record<string, string> = {
  mon: "Mon",
  tue: "Tue",
  wed: "Wed",
  thu: "Thu",
  fri: "Fri",
  sat: "Sat",
  sun: "Sun",
};

function sortDays(days: string[]): string[] {
  return [...days].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
}

/** Full names, comma-joined: "Tuesday, Wednesday". */
export function formatDays(days: string[]): string {
  return sortDays(days)
    .map((d) => FULL[d] ?? d)
    .join(", ");
}

/** Compact label: "Tue–Wed" for a contiguous run, else "Tue, Thu". */
export function formatDayRange(days: string[]): string {
  const sorted = sortDays(days);
  if (sorted.length === 0) return "";
  if (sorted.length === 1) return SHORT[sorted[0]] ?? sorted[0];

  const idx = sorted.map((d) => ORDER.indexOf(d));
  const contiguous = idx.every((n, i) => i === 0 || n === idx[i - 1] + 1);
  if (contiguous) {
    return `${SHORT[sorted[0]]}–${SHORT[sorted[sorted.length - 1]]}`;
  }
  return sorted.map((d) => SHORT[d] ?? d).join(", ");
}

/** "5:30 PM" from a "HH:MM[:SS]" string. */
export function formatTime(t: string): string {
  const [hStr, m] = t.split(":");
  const h = parseInt(hStr, 10);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${m} ${ampm}`;
}

/** "5:30 PM – 10:00 PM". */
export function formatTimeRange(start: string, end: string): string {
  return `${formatTime(start)} – ${formatTime(end)}`;
}

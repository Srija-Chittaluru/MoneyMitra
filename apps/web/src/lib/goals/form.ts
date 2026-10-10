// Client-side checks give instant feedback; they mirror the API's rules
// (goals/planner.py, users/models.py), which remain the source of truth.

export const MIN_GOAL_COST = 100;
export const MAX_GOAL_AMOUNT = 1_000_000_000; // Rs 100 crore
export const MAX_GOAL_MONTHS = 480; // 40 years
export const MAX_MONTHLY_AMOUNT = 100_000_000; // Rs 10 crore

/** Whole rupees from a text field: null when empty, NaN when not a whole number. */
export function parseRupees(value: string): number | null {
  const cleaned = value.replace(/[,\s₹]/g, "");
  if (cleaned === "") return null;
  return /^\d+$/.test(cleaned) ? Number(cleaned) : Number.NaN;
}

function parseISODate(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) } : null;
}

/** Calendar months from this month to the target's month, ignoring the day (as the API counts). */
export function monthsUntil(value: string, today = new Date()): number | null {
  const date = parseISODate(value);
  if (!date) return null;
  return (date.year - today.getFullYear()) * 12 + (date.month - (today.getMonth() + 1));
}

/** "15 Apr 2027", read from the date's own parts so no timezone can shift the day. */
export function formatDate(value: string): string {
  const date = parseISODate(value.slice(0, 10));
  if (!date) return value;
  return new Date(date.year, date.month - 1, date.day).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatMonthYear(value: string): string {
  const date = parseISODate(value.slice(0, 10));
  if (!date) return value;
  return new Date(date.year, date.month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function formatPercent(rate: number, digits = 1): string {
  return `${(rate * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function rupeeError(value: number | null, { min, max, required }: { min: number; max: number; required: boolean }) {
  if (value === null) return required ? "Enter an amount." : null;
  if (Number.isNaN(value)) return "Enter a whole number of rupees.";
  if (value < min) return min <= 1 ? "Enter an amount above zero." : `Enter at least ₹${min.toLocaleString("en-IN")}.`;
  if (value > max) return "That amount is unrealistically large. Please check it.";
  return null;
}

export function targetDateError(value: string): string | null {
  const months = monthsUntil(value);
  if (months === null) return "Choose a target date.";
  if (months < 1) return "Choose a target date in a future month.";
  if (months > MAX_GOAL_MONTHS) return "Choose a target date within 40 years.";
  return null;
}

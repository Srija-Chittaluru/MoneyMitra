const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MAX_AGE_YEARS = 120;

/** Keeps only letters/digits, uppercased and capped at PAN length, as the user types. */
export function sanitizePan(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 10);
}

export function validatePan(value: string): string | null {
  if (!PAN_PATTERN.test(value.trim().toUpperCase())) {
    return "Enter a valid 10-character PAN, like ABCDE1234F.";
  }
  return null;
}

/** Today as YYYY-MM-DD in the user's local timezone (what <input type="date"> uses). */
export function todayISO(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function earliestDobISO(): string {
  return `${new Date().getFullYear() - MAX_AGE_YEARS}-01-01`;
}

export function validateDob(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    return "Enter your date of birth.";
  }
  if (value > todayISO()) return "Date of birth can't be in the future.";
  if (value < earliestDobISO()) return "Enter a valid date of birth.";
  return null;
}

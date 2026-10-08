import { twMerge } from "tailwind-merge";

type ClassValue = string | number | null | undefined | false;

// Plain string-join silently lets two classes for the same CSS property
// (e.g. a component's default `bg-surface` and a caller's override `bg-card`)
// both end up in the class list, with the winner decided by Tailwind's
// internal stylesheet order rather than by which one was meant to apply.
// twMerge resolves that: later arguments correctly override earlier ones.
export function cn(...values: ClassValue[]): string {
  return twMerge(values.filter(Boolean).join(" "));
}

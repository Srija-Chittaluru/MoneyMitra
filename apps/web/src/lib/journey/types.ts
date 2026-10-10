import type { LucideIcon } from "lucide-react";

export type JourneyWhen = "past" | "now" | "future";

export interface JourneyDetailLine {
  label: string;
  value: string;
}

export interface JourneyMilestone {
  id: string;
  when: JourneyWhen;
  /** ISO date string; drives both sorting and horizontal position. */
  date: string;
  /** Short label shown on the timeline track, e.g. "Oct 2026" or "Before now". */
  dateLabel: string;
  title: string;
  icon: LucideIcon;
  /** One-line summary shown on the collapsed marker card. */
  summary?: string;
  /** Key/value rows shown in the detail panel when this milestone is selected. */
  detailLines: JourneyDetailLine[];
  /** Longer descriptive line in the detail panel. */
  note?: string;
  actionLabel?: string;
  actionHref?: string;
}

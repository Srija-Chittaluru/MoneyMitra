export type GoalKind = "goal" | "event" | "milestone" | "decision" | "risk" | "other";

export interface JourneyGoal {
  id: string;
  kind: GoalKind;
  title: string;
  /** Only meaningful for kind === "goal". */
  amount?: number;
  /** 0–11; only set if the user picked a month. */
  targetMonth?: number;
  /** Only set if the user picked a year — a goal with no year is undated. */
  targetYear?: number;
  createdAt: string;
}

export const GOAL_KIND_OPTIONS: { kind: GoalKind; label: string; sub: string }[] = [
  { kind: "goal", label: "Goal", sub: "Something you're saving toward — gets a savings plan and affordability check" },
  { kind: "event", label: "Life event", sub: "Something happening on its own timeline" },
  { kind: "decision", label: "Decision", sub: "Something you need to decide" },
  { kind: "risk", label: "Risk or setback", sub: "Something to plan around" },
  { kind: "other", label: "Other", sub: "Anything else worth noting" },
];

export const GOAL_KIND_LABEL: Record<GoalKind, string> = {
  goal: "GOAL",
  event: "LIFE EVENT",
  milestone: "MILESTONE",
  decision: "DECISION",
  risk: "RISK",
  other: "NOTE",
};

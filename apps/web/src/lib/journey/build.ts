import {
  AlertTriangle,
  CalendarClock,
  FileStack,
  Flag,
  GitBranch,
  MapPin,
  Scale,
  StickyNote,
  Target,
  User as UserIcon,
} from "lucide-react";
import { deriveActivity, formatActivityDate } from "@/lib/dashboard/state";
import type { DashboardSummary } from "@/lib/dashboard/types";
import type { UploadedDocument } from "@/lib/documents/types";
import { formatRupees } from "@/lib/format";
import { GOAL_KIND_LABEL, type GoalKind } from "./goals";
import type { GoalOut } from "./goalsTypes";
import type { JourneyItem } from "./state";
import { isoDateToMonthIndex, ml } from "./wizardLogic";
import type { NextStep, Recommendation, Recommendations } from "@/lib/recommendations/types";
import type { User } from "@/lib/auth/types";
import type { JourneyMilestone } from "./types";

const GOAL_KIND_ICON: Record<GoalKind, typeof Target> = {
  goal: Target,
  event: Flag,
  milestone: Flag,
  decision: GitBranch,
  risk: AlertTriangle,
  other: StickyNote,
};

/** Used only internally for undated entries — never surfaced in the UI. */
const UNDATED_SENTINEL = new Date(2999, 0, 1).toISOString();

function monthIndexToDate(index: number): Date {
  return new Date(Math.floor(index / 12), index % 12, 1);
}

function itemToMilestone(item: JourneyItem, now: Date): JourneyMilestone {
  const dateObj = item.date != null ? monthIndexToDate(item.date) : null;
  const detailLines: { label: string; value: string }[] = [{ label: "Type", value: GOAL_KIND_LABEL[item.kind] }];
  if (dateObj) detailLines.push({ label: "Target", value: ml(item.date) });

  return {
    id: `item-${item.id}`,
    when: dateObj ? (dateObj.getTime() < now.getTime() ? "past" : "future") : "future",
    date: dateObj ? dateObj.toISOString() : UNDATED_SENTINEL,
    dateLabel: dateObj ? ml(item.date) : "No date yet",
    title: item.title,
    icon: GOAL_KIND_ICON[item.kind],
    summary: item.note,
    detailLines,
    note: item.note,
  };
}

/** A real, backend-persisted goal — with its genuine plan/affordability, not a client-side estimate. */
function goalToMilestone(goal: GoalOut, now: Date): JourneyMilestone {
  const monthIndex = goal.target_date != null ? isoDateToMonthIndex(goal.target_date) : null;
  const dateObj = monthIndex != null ? monthIndexToDate(monthIndex) : null;

  const detailLines: { label: string; value: string }[] = [{ label: "Type", value: GOAL_KIND_LABEL.goal }];
  if (goal.cost_today != null) detailLines.push({ label: "Amount", value: formatRupees(goal.cost_today) });
  if (dateObj) detailLines.push({ label: "Target", value: ml(monthIndex) });
  if (goal.plan) detailLines.push({ label: "Needed per month", value: formatRupees(goal.plan.monthly_needed) });

  return {
    id: `goal-${goal.id}`,
    when: dateObj ? (dateObj.getTime() < now.getTime() ? "past" : "future") : "future",
    date: dateObj ? dateObj.toISOString() : UNDATED_SENTINEL,
    dateLabel: dateObj ? ml(monthIndex) : "No date yet",
    title: goal.title,
    icon: Target,
    summary: goal.cost_today != null ? formatRupees(goal.cost_today) : (goal.plan_issue ?? undefined),
    detailLines,
    note: goal.plan_issue ?? undefined,
  };
}

/** Events and goals with no target date can't be positioned on the date-driven timeline track. */
export function buildUndatedEntries(items: JourneyItem[], goals: GoalOut[]): JourneyMilestone[] {
  const now = new Date();
  return [
    ...items.filter((i) => i.date == null).map((i) => itemToMilestone(i, now)),
    ...goals.filter((g) => g.status === "active" && g.target_date == null).map((g) => goalToMilestone(g, now)),
  ];
}

/**
 * Everything shown here is real: the user's own signup date, their actual
 * document/tax activity (reusing the exact same derivation the dashboard
 * uses), their real income/tax summary, and the live tax-saving deadline,
 * plus the user's own backend-persisted goals and locally-tracked events.
 */
export function buildMilestones(input: {
  user: User;
  documents: UploadedDocument[];
  summary: DashboardSummary | undefined;
  taxDeadlineDays: number;
  taxDeadlineFyLabel: string;
  items?: JourneyItem[];
  goals?: GoalOut[];
  /** The take-home figure the My Journey wizard itself collected — a different source from
   * `summary.annual_income` (which only comes from a filed/drafted ITR), so without this the
   * "You are here" card can wrongly claim income is missing right after the wizard collected it. */
  monthlyTakeHome?: number | null;
}): JourneyMilestone[] {
  const { user, documents, summary, taxDeadlineDays, taxDeadlineFyLabel, items = [], goals = [], monthlyTakeHome } = input;
  const milestones: JourneyMilestone[] = [];
  const now = new Date();

  milestones.push({
    id: "joined",
    when: "past",
    date: user.created_at,
    dateLabel: formatActivityDate(user.created_at),
    title: "Joined MoneyMitra",
    icon: UserIcon,
    detailLines: [
      { label: "When", value: formatActivityDate(user.created_at) },
      { label: "Type", value: "Milestone" },
    ],
    note: "Where your MoneyMitra journey started.",
  });

  for (const item of deriveActivity(summary, documents, documents.length || 1)) {
    milestones.push({
      id: item.id,
      when: "past",
      date: item.at,
      dateLabel: formatActivityDate(item.at),
      title: item.title,
      icon: item.kind === "tax" ? Scale : FileStack,
      summary: item.subtitle,
      detailLines: [
        { label: "When", value: formatActivityDate(item.at) },
        { label: "Type", value: item.kind === "tax" ? "Tax figures" : "Document" },
      ],
      note: item.subtitle,
    });
  }

  const nowDetail: { label: string; value: string }[] = [];
  if (summary?.annual_income != null) nowDetail.push({ label: "Annual income", value: formatRupees(summary.annual_income) });
  if (summary?.estimated_tax) nowDetail.push({ label: "Estimated tax", value: formatRupees(summary.estimated_tax.amount) });
  if (monthlyTakeHome != null) nowDetail.push({ label: "Monthly take-home", value: formatRupees(monthlyTakeHome) });
  milestones.push({
    id: "now",
    when: "now",
    date: now.toISOString(),
    dateLabel: "Now",
    title: "You are here",
    icon: MapPin,
    detailLines: nowDetail,
    note: nowDetail.length > 0 ? undefined : "Add your income details to see where you stand today.",
  });

  const deadlineDate = new Date(now.getTime() + taxDeadlineDays * 24 * 60 * 60 * 1000);
  milestones.push({
    id: "tax-deadline",
    when: "future",
    date: deadlineDate.toISOString(),
    dateLabel: "31 March",
    title: "Tax-saving window closes",
    icon: CalendarClock,
    detailLines: [
      { label: "Days left", value: String(taxDeadlineDays) },
      { label: "Financial year", value: taxDeadlineFyLabel },
    ],
    note: "Investments for 80C, 80D, NPS and more must be made before this date to count for this year.",
    actionLabel: "See your tax plan",
    actionHref: "/tax-planning",
  });

  for (const item of items) {
    if (item.date == null) continue; // undated ones render separately, see buildUndatedEntries
    milestones.push(itemToMilestone(item, now));
  }
  for (const goal of goals) {
    if (goal.status !== "active" || goal.target_date == null) continue;
    milestones.push(goalToMilestone(goal, now));
  }

  return milestones.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export type NextMove =
  | { kind: "next_step"; step: NextStep }
  | { kind: "recommendation"; rec: Recommendation }
  | null;

/** The user's real next action: the engine's own next_step, or their top open recommendation. */
export function pickNextMove(recommendations: Recommendations | undefined): NextMove {
  if (!recommendations) return null;
  if (recommendations.next_step) return { kind: "next_step", step: recommendations.next_step };
  const open = recommendations.recommendations.find((rec) => rec.status === "open");
  return open ? { kind: "recommendation", rec: open } : null;
}

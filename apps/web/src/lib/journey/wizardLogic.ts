import { GT, NO_FUND, type GoalTypeId } from "./goalTypes";
import type { GoalOut } from "./goalsTypes";
import type { DraftGoal } from "./state";

/** Month-index for "now", e.g. Oct 2026 = 2026*12+9 — same unit everything else here uses. */
export function nowIndex(): number {
  const d = new Date();
  return d.getFullYear() * 12 + d.getMonth();
}

/** Month-index -> an ISO date (backend's `target_date`), defaulting to the 15th. */
export function monthIndexToIsoDate(index: number, day = 15): string {
  const year = Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** ISO date (backend's `target_date`) -> month-index, the unit the wizard's chips/labels use. */
export function isoDateToMonthIndex(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  return d.getFullYear() * 12 + d.getMonth();
}

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Month-index -> "Mar 2028". */
export function ml(i: number | null | undefined): string {
  if (i == null) return "";
  return MON[((i % 12) + 12) % 12] + " " + Math.floor(i / 12);
}

export function inr(n: number | null | undefined): string {
  return "₹" + Math.round(n || 0).toLocaleString("en-IN");
}

function tz(s: string): string {
  return s.indexOf(".") >= 0 ? s.replace(/0+$/, "").replace(/\.$/, "") : s;
}

/** Compact rupee amount — "₹1.25 Cr" / "₹3.4 L" / "₹24,500". */
export function cmp(n: number): string {
  if (n >= 1e7) return "₹" + tz((n / 1e7).toFixed(2)) + " Cr";
  if (n >= 1e5) return "₹" + tz((n / 1e5).toFixed(2)) + " L";
  return inr(n);
}

/** Month count -> "8 months" / "2 years 3 mo". */
export function dur(m: number): string {
  if (m < 12) return m + (m === 1 ? " month" : " months");
  const years = Math.floor(m / 12);
  return years + (years === 1 ? " year" : " years") + (m % 12 ? " " + (m % 12) + " mo" : "");
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

/** Log-scaled slider position (0-1000) for a value within [min, max]. */
export function toS(v: number, r: [number, number]): number {
  return Math.round((Math.log(Math.max(r[0], Math.min(r[1], v)) / r[0]) / Math.log(r[1] / r[0])) * 1000);
}

/** Inverse of toS — slider position back to a rupee value, rounded to a sensible step. */
export function fromS(s: number, r: [number, number]): number {
  const v = r[0] * Math.pow(r[1] / r[0], s / 1000);
  const step = v < 1e5 ? 1000 : v < 1e6 ? 10000 : v < 1e7 ? 50000 : 500000;
  return Math.round(v / step) * step;
}

/** Pulls a rough year, amount and cleaned-up title out of free text like "Study abroad in 2028, about 30 lakh". */
export function parseDesc(s: string): { date?: number; amount?: number; title?: string } {
  const out: { date?: number; amount?: number; title?: string } = {};
  const y = s.match(/\b(20[2-7]\d)\b/);
  if (y) out.date = +y[1] * 12 + 5;
  const a = s.replace(/\b20[2-7]\d\b/g, "").match(/(?:₹|rs\.?|inr)?\s*(\d+(?:[.,]\d+)*)\s*(crores?|cr|lakhs?|lacs?|l|k|thousand)?\b/i);
  if (a) {
    let n = parseFloat(a[1].replace(/,/g, ""));
    const u = (a[2] || "").toLowerCase();
    if (u[0] === "c") n *= 1e7;
    else if (u[0] === "l") n *= 1e5;
    else if (u === "k" || u === "thousand") n *= 1e3;
    if (n >= 1000) out.amount = Math.round(n);
  }
  const t = s
    .replace(/^\s*(i\s+(want|would like|wanna|plan|hope|need)\s+to|i'd like to|i'm planning to)\s+/i, "")
    .replace(/[,\s]+(in|by|around|before|for|about|roughly|costing|worth)\b.*$/i, "")
    .replace(/[,\s]*(₹|rs\.?)?\s*\d[\d.,]*\s*(crores?|cr|lakhs?|lacs?|l|k)?\b.*$/i, "")
    .trim();
  if (t) out.title = t.charAt(0).toUpperCase() + t.slice(1, 48);
  return out;
}

export type StepKind = "hello" | "stage" | "income" | "saving" | "goals" | "kind" | "when" | "amount" | "fund" | "rank" | "events" | "reveal";

export interface WizardStep {
  k: StepKind;
  id?: string;
}

/**
 * The entire wizard sequence, re-derived fresh every time from the goals
 * currently being drafted rather than stored as a fixed list — so adding or
 * removing a goal mid-wizard naturally grows/shrinks the remaining steps.
 * `existingActiveGoalCount` is how many *already-created* (backend) goals the
 * user has, so "rank" shows up even when today's wizard only adds one more
 * goal to an already-multi-goal journey.
 */
export function buildSteps(draftGoals: DraftGoal[], existingActiveGoalCount: number): WizardStep[] {
  const steps: WizardStep[] = [{ k: "hello" }, { k: "stage" }, { k: "income" }, { k: "saving" }, { k: "goals" }];
  draftGoals.forEach((g) => {
    const gt = g.type !== "custom" ? GT[g.type as GoalTypeId] : undefined;
    if (gt && gt.kinds) steps.push({ k: "kind", id: g.id });
    steps.push({ k: "when", id: g.id }, { k: "amount", id: g.id });
    if (g.type === "custom" || !NO_FUND[g.type as GoalTypeId]) steps.push({ k: "fund", id: g.id });
  });
  if (existingActiveGoalCount + draftGoals.length >= 2) steps.push({ k: "rank" });
  steps.push({ k: "events" }, { k: "reveal" });
  return steps;
}

/** True once a draft goal's last question (fund, or amount when there's no fund step) has been reached. */
export function isDraftGoalLastQuestion(step: WizardStep, goal: DraftGoal): boolean {
  if (step.k === "fund") return true;
  if (step.k !== "amount") return false;
  if (goal.type === "custom") return false;
  return !!NO_FUND[goal.type as GoalTypeId];
}

export interface Suggestion {
  what: string;
  why: string;
  impact: string;
}

/**
 * Turns a goal's real backend affordability assessment into a single
 * actionable suggestion — used by the reveal screen, the detail panel and the
 * "next move" panel alike, so they all say the same thing about a given goal.
 */
export function affordabilitySuggestion(goal: GoalOut): Suggestion | undefined {
  const a = goal.affordability;
  if (!a) return undefined;
  if (a.later_date) {
    return {
      what: `Move the target to ${ml(isoDateToMonthIndex(a.later_date.target_date))}`,
      why: "Fits your budget better at this pace, with everything else unchanged.",
      impact: `${inr(a.later_date.monthly_needed)} a month instead of ${inr(goal.plan?.monthly_needed ?? 0)}`,
    };
  }
  if (a.lower_cost) {
    return {
      what: `Aim for ${cmp(a.lower_cost.cost_today)} instead`,
      why: "A lower cost reaches the same date within your budget.",
      impact: `${inr(a.lower_cost.monthly_needed)} a month`,
    };
  }
  if (a.loan && a.loan.emi_fits) {
    return {
      what: "Consider financing part of this with a loan",
      why: a.loan.note,
      impact: `EMI of ${inr(a.loan.emi)} a month`,
    };
  }
  if (a.reasons.length > 0) {
    return { what: "Take a look at this goal", why: a.reasons[0], impact: "" };
  }
  return undefined;
}

export interface AffordabilityOption {
  key: "later_date" | "lower_cost" | "loan";
  label: string;
  detail: string;
}

/**
 * Every concrete alternative the backend worked out for a goal that doesn't comfortably
 * fit — not just the single best one `affordabilitySuggestion` picks. A goal can have more
 * than one real option (e.g. both a cheaper target and a loan), and the user should be able
 * to see and weigh all of them, not just the first match in a priority order.
 */
export function affordabilityOptions(goal: GoalOut): AffordabilityOption[] {
  const a = goal.affordability;
  if (!a) return [];
  const options: AffordabilityOption[] = [];
  if (a.later_date) {
    options.push({
      key: "later_date",
      label: "Push the target date",
      detail: `Move to ${ml(isoDateToMonthIndex(a.later_date.target_date))} — ${inr(a.later_date.monthly_needed)} a month instead of ${inr(goal.plan?.monthly_needed ?? 0)}.`,
    });
  }
  if (a.lower_cost) {
    options.push({
      key: "lower_cost",
      label: "Aim for less",
      detail: `${cmp(a.lower_cost.cost_today)} instead of ${goal.cost_today != null ? cmp(goal.cost_today) : "your current target"} would fit the same date — e.g. a smaller, older or second-hand option.`,
    });
  }
  if (a.loan) {
    options.push({
      key: "loan",
      label: "Finance part with a loan",
      detail: `EMI of ${inr(a.loan.emi)} a month for ${Math.round(a.loan.term_months / 12)} years after you buy. ${a.loan.note}`,
    });
  }
  return options;
}

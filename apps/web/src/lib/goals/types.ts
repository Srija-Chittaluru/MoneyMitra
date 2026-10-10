// Mirrors app/modules/goals/schemas.py. Every figure is calculated by the API from
// the goal's current inputs; the client never works one out itself.

export const GOAL_TYPES = [
  { id: "car", name: "Car" },
  { id: "house", name: "House" },
  { id: "vacation", name: "Vacation" },
  { id: "education", name: "Education" },
  { id: "emergency_fund", name: "Emergency fund" },
  { id: "wedding", name: "Wedding" },
  { id: "retirement", name: "Retirement" },
  { id: "other", name: "Other" },
] as const;

export type GoalType = (typeof GOAL_TYPES)[number]["id"];
export type GoalStatus = "active" | "completed" | "archived";
export type AffordabilityStatus = "affordable" | "tight" | "unaffordable" | "unknown";
export type Risk = "low" | "medium" | "high";
export type TakeHomeReliability =
  | "confirmed"
  | "estimated"
  | "stale"
  | "expected_only"
  | "incomplete"
  | "unavailable";

export function goalTypeName(type: GoalType): string {
  return GOAL_TYPES.find((t) => t.id === type)?.name ?? "Other";
}

/** Only these goal types ever get a loan illustration. */
export const LOAN_GOAL_TYPES: readonly GoalType[] = ["car", "house"];

export interface GoalInput {
  title: string;
  goal_type: GoalType;
  target_date: string; // YYYY-MM-DD
  cost_today: number;
  existing_savings: number;
}

export interface Approach {
  key: string;
  label: string;
  risk: Risk;
  annual_rate: number;
  suggestion: string;
}

export interface GoalPlan {
  months: number;
  inflation_rate: number;
  future_cost: number;
  funding_counted: number;
  remaining: number;
  approach: Approach;
  monthly_needed: number;
  assumptions: string[];
  disclosure: string;
}

export interface TakeHome {
  reliability: TakeHomeReliability;
  monthly: number | null;
  source: string | null;
  financial_year: string | null;
  professional_tax_estimated: boolean;
}

export interface ContributionSchedule {
  count: number;
  monthly: number;
  first_due: string;
  last_due: string;
  description: string;
}

export interface Breakdown {
  take_home: number;
  expenses: number;
  expenses_estimated: boolean;
  commitments: number;
  available: number;
  comfortable: number;
}

export interface LaterDate {
  target_date: string;
  months: number;
  monthly_needed: number;
  future_cost: number;
  approach: Approach;
}

export interface LowerCost {
  cost_today: number;
  future_cost: number;
  monthly_needed: number;
}

export interface LoanIllustration {
  annual_rate: number;
  term_months: number;
  monthly_savings: number;
  down_payment: number;
  loan_amount: number;
  emi: number;
  total_interest: number;
  emi_fits: boolean;
  note: string;
}

export interface Affordability {
  status: AffordabilityStatus;
  reasons: string[];
  take_home: TakeHome;
  schedule: ContributionSchedule | null;
  breakdown: Breakdown | null;
  later_date: LaterDate | null;
  lower_cost: LowerCost | null;
  loan: LoanIllustration | null;
  notes: string[];
}

export interface Goal {
  id: string;
  title: string;
  goal_type: GoalType;
  target_date: string;
  cost_today: number;
  existing_savings: number;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  contributions_total: number;
  current_funding: number;
  plan: GoalPlan | null;
  plan_issue: string | null;
  affordability: Affordability | null;
}

export interface ContributionInput {
  amount: number;
  contributed_on: string;
  note: string | null;
}

export interface Contribution {
  id: string;
  goal_id: string;
  amount: number;
  contributed_on: string;
  note: string | null;
  created_at: string;
}

export interface FinancialProfile {
  monthly_take_home: number | null;
  monthly_expenses: number | null;
}

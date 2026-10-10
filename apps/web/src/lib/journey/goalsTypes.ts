import type { GoalTypeId } from "./goalTypes";

export type BackendGoalType = GoalTypeId | "custom";
export type GoalStatus = "active" | "completed" | "archived";

export interface GoalIn {
  title: string;
  goal_type: BackendGoalType;
  target_date?: string | null;
  cost_today?: number | null;
  existing_savings?: number;
  loan_pct?: number;
}

export interface ApproachOut {
  key: string;
  label: string;
  risk: string;
  annual_rate: number;
  suggestion: string;
}

export interface PlanOut {
  months: number;
  inflation_rate: number;
  future_cost: number;
  funding_counted: number;
  financed_by_loan: number;
  remaining: number;
  approach: ApproachOut;
  monthly_needed: number;
  assumptions: string[];
  disclosure: string;
}

export interface TakeHomeOut {
  reliability: string;
  monthly: number | null;
  source: string | null;
  financial_year: string | null;
  professional_tax_estimated: boolean;
}

export interface ScheduleOut {
  count: number;
  monthly: number;
  first_due: string;
  last_due: string;
  description: string;
}

export interface BreakdownOut {
  take_home: number;
  expenses: number;
  expenses_estimated: boolean;
  commitments: number;
  available: number;
  comfortable: number;
}

export interface LaterDateOut {
  target_date: string;
  months: number;
  monthly_needed: number;
  future_cost: number;
  approach: ApproachOut;
}

export interface LowerCostOut {
  cost_today: number;
  future_cost: number;
  monthly_needed: number;
}

export interface LoanOut {
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

export interface AffordabilityOut {
  status: "affordable" | "tight" | "unaffordable" | "unknown";
  reasons: string[];
  take_home: TakeHomeOut;
  schedule: ScheduleOut | null;
  breakdown: BreakdownOut | null;
  later_date: LaterDateOut | null;
  lower_cost: LowerCostOut | null;
  loan: LoanOut | null;
  notes: string[];
}

export interface GoalOut {
  id: string;
  title: string;
  goal_type: BackendGoalType;
  target_date: string | null;
  cost_today: number | null;
  existing_savings: number;
  loan_pct: number;
  priority: number;
  status: GoalStatus;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  contributions_total: number;
  current_funding: number;
  plan: PlanOut | null;
  plan_issue: string | null;
  affordability: AffordabilityOut | null;
}

export interface FinancialProfile {
  monthly_take_home: number | null;
  monthly_expenses: number | null;
}

export interface ContributionIn {
  amount: number;
  contributed_on: string;
  note?: string | null;
}

export interface ContributionOut {
  id: string;
  goal_id: string;
  amount: number;
  contributed_on: string;
  note: string | null;
  created_at: string;
}

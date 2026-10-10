export type ExpertFilingPlan = "assisted" | "premium";
export type ExpertFilingStatus = "pending" | "contacted" | "scheduled" | "completed" | "cancelled";

export interface ExpertFilingRequestIn {
  assessment_year: string;
  plan: ExpertFilingPlan;
  contact_phone: string;
  preferred_time: string | null;
}

export interface ExpertFilingRequest {
  id: string;
  assessment_year: string;
  plan: ExpertFilingPlan;
  price: number;
  calls_included: number;
  status: ExpertFilingStatus;
  contact_phone: string;
  preferred_time: string | null;
  created_at: string;
}

/** Display copy for the plan picker — prices/call counts mirror backend PLAN_DETAILS. */
export const PLAN_OPTIONS: {
  plan: ExpertFilingPlan;
  label: string;
  price: number;
  callsIncluded: number;
}[] = [
  { plan: "assisted", label: "Assisted", price: 499, callsIncluded: 1 },
  { plan: "premium", label: "Premium", price: 1999, callsIncluded: 1 },
];

export const STATUS_LABELS: Record<ExpertFilingStatus, string> = {
  pending: "Received — we'll call you soon",
  contacted: "You've been contacted",
  scheduled: "Call scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

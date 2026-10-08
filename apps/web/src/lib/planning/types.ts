import type { Recommendation } from "@/lib/recommendations/types";

export interface InstrumentOption {
  name: string;
  description: string;
  lock_in: string;
  type: string;
  why: string;
  link: string | null;
}

export interface PlanningSection {
  section: string;
  label: string;
  cap: number;
  declared_amount: number;
  headroom: number;
  monthly_target: number;
  /** What this section held in the year the saved figures are for, when that isn't this year. */
  last_year_amount: number | null;
  /** True when declared_amount is last year's figure assumed to continue (e.g. home loan interest). */
  carried_forward: boolean;
  note: string | null;
  instruments: InstrumentOption[];
}

export interface RegimePosition {
  recommended_regime: "old" | "new" | "either";
  difference: number;
}

export interface TaxPlan {
  has_data: boolean;
  fy_label: string;
  fy_end: string;
  months_remaining: number;
  /** Both null when the user has no date of birth on file. */
  age: number | null;
  stage_label: string | null;
  context_source: "itr_filing" | "tax_comparison" | null;
  /** The financial year the saved figures are for, and whether that is the current one. */
  data_fy_label: string | null;
  data_is_current_year: boolean;
  /** Null when has_data is false — nothing to compare yet. */
  regime_position: RegimePosition | null;
  regime_caveat: string;
  sections: PlanningSection[];
  /** Cross-section nudges: regime fit, timing, priority. Empty when has_data is false. */
  recommendations: Recommendation[];
}

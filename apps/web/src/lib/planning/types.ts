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
  /** Null when has_data is false — nothing to compare yet. */
  regime_position: RegimePosition | null;
  regime_caveat: string;
  sections: PlanningSection[];
}

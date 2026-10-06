export type LifeStage = "career_start" | "mid_career" | "pre_retirement";

export interface LifeStageRecommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  action_label: string;
  action_href: string;
}

export interface LifeStageRecommendations {
  /** All null when the user has no date of birth on file. */
  age: number | null;
  stage: LifeStage | null;
  stage_label: string | null;
  /** True when the advice used the user's income/deduction data, not just age. */
  personalized: boolean;
  /** Where that data came from: their ITR filing draft or their latest tax comparison. */
  context_source: "itr_filing" | "tax_comparison" | null;
  recommendations: LifeStageRecommendation[];
}

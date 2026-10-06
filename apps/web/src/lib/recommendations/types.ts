export type LifeStage = "career_start" | "mid_career" | "pre_retirement";
export type EmployeeCategory = "government" | "psu" | "private" | "other";
export type RecommendationCategory = "tax_saving" | "life_stage";

export interface RecommendationProfile {
  date_of_birth: string | null;
  employee_category: EmployeeCategory | null;
  expected_annual_income: number | null;
}

export interface Recommendation {
  id: string;
  category: RecommendationCategory;
  /** The data level the advice is built on: 1 = profile/general, 2 = your income, 3 = your documents. */
  level: number;
  title: string;
  description: string;
  reason: string;
  /** One short line saying what the advice is based on. */
  basis: string;
  action_label: string;
  action_href: string;
}

export interface NextStep {
  level: number;
  title: string;
  description: string;
  action_label: string;
  /** null means "complete the profile card on this page". */
  action_href: string | null;
}

export interface Recommendations {
  /** 0 = no profile yet, 1 = profile, 2 = your income, 3 = your documents. */
  level: number;
  level_label: string;
  tax_year: string;
  available_tax_years: string[];
  profile: RecommendationProfile;
  age: number | null;
  stage: LifeStage | null;
  stage_label: string | null;
  context_source: "itr_filing" | "tax_comparison" | null;
  next_step: NextStep | null;
  recommendations: Recommendation[];
}

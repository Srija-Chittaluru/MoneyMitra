export type LifeStage = "career_start" | "mid_career" | "pre_retirement";
export type EmployeeCategory = "government" | "psu" | "private" | "other";
export type RecommendationCategory = "tax_saving" | "life_stage";

export interface RecommendationProfile {
  date_of_birth: string | null;
  employee_category: EmployeeCategory | null;
  expected_annual_income: number | null;
}

/** One place the money could go, described by type (no specific product or fund). */
export interface InvestmentOption {
  name: string;
  summary: string;
  risk: "low" | "medium" | "high";
  suits: string;
}

export interface IllustrationLine {
  label: string;
  value: string;
  /** The line that carries the point of the example. */
  emphasis: boolean;
}

/** Worked numbers that show what the advice is worth. */
export interface Illustration {
  title: string;
  lines: IllustrationLine[];
  /** The assumptions behind the numbers. */
  note: string;
  /** True when the figures use a sample income because the user's own isn't known yet. */
  is_example: boolean;
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
  /** Concrete how-to steps; empty for advice that is just a headline. */
  steps: string[];
  illustration: Illustration | null;
  options: InvestmentOption[];
  action_label: string | null;
  action_href: string | null;
  status: "open" | "done" | "dismissed";
}

export interface NextStep {
  level: number;
  title: string;
  description: string;
  action_label: string;
  /** null means "complete the profile card on this page". */
  action_href: string | null;
}

export interface AnalysedDocument {
  category: string;
  /** Short name, e.g. "Form 16". */
  label: string;
  file_name: string;
}

export interface SkippedDocument {
  category: string;
  file_name: string;
  /** Why this document wasn't used for advice. */
  reason: string;
}

/** Which uploaded documents the advice is based on, and why others weren't used. */
export interface DocumentsReport {
  analysed: AnalysedDocument[];
  skipped: SkippedDocument[];
}

export interface Recommendations {
  /** 0 = no profile yet, 1 = profile, 2 = your income, 3 = your documents. */
  level: number;
  level_label: string;
  profile: RecommendationProfile;
  age: number | null;
  stage: LifeStage | null;
  stage_label: string | null;
  context_source: "itr_filing" | "tax_comparison" | null;
  next_step: NextStep | null;
  documents: DocumentsReport;
  /** General-guidance and illustrative-rates notice to show with the advice. */
  disclaimer: string;
  recommendations: Recommendation[];
}

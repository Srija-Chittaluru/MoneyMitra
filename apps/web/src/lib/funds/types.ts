/** Mirrors the backend MutualFundsOut (GET /api/v1/funds/mutual-funds). */

export type Cap = "large" | "mid" | "small";

export interface NavPoint {
  date: string;
  nav: number;
}

export interface CapCategory {
  cap: Cap;
  label: string;
  benchmark: string;
  scheme_code: number;
  scheme_name: string;
  risk: "Moderate" | "High" | "Very high";
  what_it_is: string;
  suits: string;
  min_years: number;
  latest_nav: number;
  latest_nav_date: string;
  /** Compound annual growth, % a year; null when the fund isn't that old. */
  returns: { one_year: number | null; three_year: number | null; five_year: number | null };
  /** Largest fall from a high to a later low, as a negative %. */
  worst_fall: number;
  /** Month-end NAVs, oldest first; the last point is the latest NAV. */
  history: NavPoint[];
}

export type FundListId = "large" | "mid" | "small" | "elss";

export interface FundReturnsRow {
  scheme_code: number;
  name: string;
  nav: number;
  one_year: number | null;
  three_year: number | null;
  five_year: number | null;
}

export interface FundList {
  id: string;
  label: string;
  note: string | null;
  average: { one_year: number | null; three_year: number | null; five_year: number | null };
  /** Every Direct-Growth fund in the category, best 3-year return first. */
  funds: FundReturnsRow[];
}

export interface CapRecommendation {
  cap: Cap;
  title: string;
  reasons: string[];
  mix: Record<Cap, number>;
  monthly_sip: number | null;
  years_to_invest: number;
  basis: string;
}

export interface MutualFundsResponse {
  categories: CapCategory[];
  fund_lists: FundList[];
  fund_lists_as_of: string;
  recommendation: CapRecommendation | null;
  missing: ("date_of_birth" | "income")[];
  as_of: string;
  live: boolean;
  source: string;
  disclaimer: string;
}

export interface EtfBenchmark {
  id: "nifty50" | "gold" | "silver";
  label: string;
  scheme_name: string;
  latest_nav: number;
  latest_nav_date: string;
  returns: { one_year: number | null; three_year: number | null; five_year: number | null };
  worst_fall: number;
  history: NavPoint[];
}

export interface EtfsResponse {
  lists: FundList[];
  benchmarks: EtfBenchmark[];
  /** Nifty 50 / gold / silver split for the user's age; null until it's known. */
  mix: { nifty50: number; gold: number; silver: number } | null;
  mix_basis: string | null;
  tips: string[];
  as_of: string;
  source: string;
  disclaimer: string;
}

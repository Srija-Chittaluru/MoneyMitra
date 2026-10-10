/** Mirrors the backend RdRatesOut (GET /api/v1/deposits/rd-rates). */

export type RdTenure = "1y" | "2y" | "3y" | "5y";

export interface RdTenureInfo {
  id: RdTenure;
  label: string;
  months: number;
}

export interface RdRate {
  provider_id: string;
  provider_name: string;
  kind: "bank" | "post_office";
  tenure: RdTenure;
  customer_category: "general" | "senior_citizen";
  /** Percent a year, e.g. 6.4 means 6.4% p.a. */
  annual_rate: number;
  /** Null when the bank doesn't publish a verified minimum. */
  min_monthly: number | null;
  effective_date: string;
  source: string;
  source_url: string;
}

export interface RdRatesResponse {
  tenures: RdTenureInfo[];
  rates: RdRate[];
  is_senior: boolean;
  suggested_monthly: number | null;
  suggestion_basis: string | null;
  checked_on: string;
  disclaimer: string;
}

/**
 * What an RD pays at maturity, compounded quarterly as Indian banks do: each
 * monthly instalment earns interest for the months it stays deposited.
 * Mirrors `maturity()` in the backend's deposits service.
 */
export function rdMaturity(monthly: number, annualRate: number, months: number): number {
  const quarterly = annualRate / 400;
  let total = 0;
  for (let remaining = months; remaining > 0; remaining--) total += monthly * (1 + quarterly) ** (remaining / 3);
  return Math.round(total);
}

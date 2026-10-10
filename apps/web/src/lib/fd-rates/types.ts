// The shape a future FD-rates API will return (snake_case, like the rest of the API),
// so the page needs no redesign when sample data is replaced by real, sourced rates.

export const FD_TENURES = [
  { id: "up_to_2y", label: "Up to 2 years" },
  { id: "2y_to_4y", label: "2 to 4 years" },
  { id: "4y_plus", label: "4 years and above" },
] as const;

export type FdTenure = (typeof FD_TENURES)[number]["id"];
export type CustomerCategory = "general" | "senior_citizen";

export interface FdRate {
  bank_id: string;
  bank_name: string;
  tenure: FdTenure;
  /** Percent a year, e.g. 7.1 means 7.1% p.a. */
  annual_rate: number;
  customer_category: CustomerCategory;
  /** When the bank's rate took effect; null for sample data. */
  effective_date: string | null;
  /** Where the rate was published; null for sample data. */
  source_url: string | null;
}

export interface FdRatesResponse {
  rates: FdRate[];
  /** True while the page runs on illustrative sample data rather than sourced rates. */
  is_sample: boolean;
}

export function tenureLabel(tenure: FdTenure): string {
  return FD_TENURES.find((t) => t.id === tenure)?.label ?? tenure;
}

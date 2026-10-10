import { FD_RATES } from "./rates";
import type { FdRatesResponse } from "./types";

/**
 * FD rates for the comparison page: real published rates for 10 banks, kept in
 * rates.ts. When a backend rates API exists this becomes
 * `apiFetch<FdRatesResponse>("/api/v1/fd-rates")` with no change to the page.
 */
export async function getFdRates(): Promise<FdRatesResponse> {
  return { rates: FD_RATES, is_sample: false };
}

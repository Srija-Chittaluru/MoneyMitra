import { MOCK_FD_RATES } from "@/lib/mock/fdRates";
import type { FdRatesResponse } from "./types";

/**
 * FD rates for the comparison page. For now this returns sample data, flagged
 * `is_sample`; when the backend exists it becomes
 * `apiFetch<FdRatesResponse>("/api/v1/fd-rates")` with no change to the page.
 */
export async function getFdRates(): Promise<FdRatesResponse> {
  return { rates: MOCK_FD_RATES, is_sample: true };
}

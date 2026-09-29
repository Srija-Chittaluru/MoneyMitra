import { apiFetch } from "@/lib/api-client";
import type { TaxComparisonInput, TaxComparisonResult } from "./types";

export function getSupportedTaxYears() {
  return apiFetch<string[]>("/api/v1/tax/years");
}

export function compareTaxRegimes(input: TaxComparisonInput) {
  return apiFetch<TaxComparisonResult>("/api/v1/tax/comparison", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

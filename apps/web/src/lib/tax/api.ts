import { apiFetch } from "@/lib/api-client";
import type {
  ChatRequest,
  ChatResponse,
  ExplanationResult,
  SlabTable,
  TaxComparisonInput,
  TaxComparisonResult,
} from "./types";

export function getSupportedTaxYears() {
  return apiFetch<string[]>("/api/v1/tax/years");
}

export function compareTaxRegimes(input: TaxComparisonInput) {
  return apiFetch<TaxComparisonResult>("/api/v1/tax/comparison", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function explainTaxComparison(comparison: TaxComparisonResult) {
  return apiFetch<ExplanationResult>("/api/v1/tax/explain", {
    method: "POST",
    body: JSON.stringify({ comparison }),
  });
}

export function sendChatMessage(request: ChatRequest) {
  return apiFetch<ChatResponse>("/api/v1/tax/chat", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

export function getSlabTable(taxYear: string, ageCategory: string = "general") {
  const params = new URLSearchParams({ tax_year: taxYear, age_category: ageCategory });
  return apiFetch<SlabTable>(`/api/v1/tax/slabs?${params}`);
}

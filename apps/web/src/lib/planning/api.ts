import { apiFetch } from "@/lib/api-client";
import type { TaxPlan } from "./types";

export function getTaxPlan() {
  return apiFetch<TaxPlan>("/api/v1/planning/tax-plan");
}

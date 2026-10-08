import { apiFetch } from "@/lib/api-client";
import type { FinanceOverview } from "./types";

export function getFinanceOverview() {
  return apiFetch<FinanceOverview>("/api/v1/finance/overview");
}

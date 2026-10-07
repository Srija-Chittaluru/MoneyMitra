import { apiFetch } from "@/lib/api-client";
import type { DashboardSummary } from "./types";

export function getDashboardSummary() {
  return apiFetch<DashboardSummary>("/api/v1/dashboard/summary");
}

import { apiFetch } from "@/lib/api-client";
import type { FinancialProfile } from "./goalsTypes";

export function getFinancialProfile() {
  return apiFetch<FinancialProfile>("/api/v1/users/me/financial-profile");
}

export function updateFinancialProfile(profile: FinancialProfile) {
  return apiFetch<FinancialProfile>("/api/v1/users/me/financial-profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

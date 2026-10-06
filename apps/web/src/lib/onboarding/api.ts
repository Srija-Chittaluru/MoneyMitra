import { apiFetch } from "@/lib/api-client";
import type { User } from "@/lib/auth/types";

export interface TaxProfileInput {
  pan: string;
  date_of_birth: string;
}

export function saveTaxProfileRequest(input: TaxProfileInput) {
  return apiFetch<User>("/api/v1/users/me/tax-profile", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function skipTaxOnboardingRequest() {
  return apiFetch<User>("/api/v1/users/me/tax-onboarding/skip", { method: "POST" });
}

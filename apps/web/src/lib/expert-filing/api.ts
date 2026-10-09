import { apiFetch } from "@/lib/api-client";
import type { ExpertFilingRequest, ExpertFilingRequestIn } from "./types";

export function createExpertFilingRequest(payload: ExpertFilingRequestIn) {
  return apiFetch<ExpertFilingRequest>("/api/v1/expert-filing/requests", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getLatestExpertFilingRequest(assessmentYear: string) {
  return apiFetch<ExpertFilingRequest | null>(
    `/api/v1/expert-filing/requests/latest?assessment_year=${encodeURIComponent(assessmentYear)}`,
  );
}

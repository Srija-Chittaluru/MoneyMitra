import { apiFetch } from "@/lib/api-client";
import type { RecommendationProfile, Recommendations } from "./types";

export function getRecommendations(taxYear?: string) {
  const query = taxYear ? `?tax_year=${encodeURIComponent(taxYear)}` : "";
  return apiFetch<Recommendations>(`/api/v1/recommendations${query}`);
}

export function updateRecommendationProfile(profile: RecommendationProfile) {
  return apiFetch<RecommendationProfile>("/api/v1/recommendations/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

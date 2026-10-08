import { apiFetch } from "@/lib/api-client";
import type { RecommendationProfile, Recommendations } from "./types";

export function getRecommendations() {
  return apiFetch<Recommendations>("/api/v1/recommendations");
}

export function updateRecommendationProfile(profile: RecommendationProfile) {
  return apiFetch<RecommendationProfile>("/api/v1/recommendations/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

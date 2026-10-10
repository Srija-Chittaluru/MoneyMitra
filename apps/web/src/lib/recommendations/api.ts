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

export function setRecommendationStatus(id: string, status: "done" | "dismissed") {
  return apiFetch<{ recommendation_id: string; status: string }>(`/api/v1/recommendations/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function clearRecommendationStatus(id: string) {
  return apiFetch<void>(`/api/v1/recommendations/${id}/status`, { method: "DELETE" });
}

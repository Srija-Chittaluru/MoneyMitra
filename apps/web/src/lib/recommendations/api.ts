import { apiFetch } from "@/lib/api-client";
import type { LifeStageRecommendations } from "./types";

export function getLifeStageRecommendations() {
  return apiFetch<LifeStageRecommendations>("/api/v1/recommendations/life-stage");
}

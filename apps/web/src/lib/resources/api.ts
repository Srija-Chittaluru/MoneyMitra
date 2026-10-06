import { apiFetch } from "@/lib/api-client";
import type { Resources } from "./types";

export function getResources() {
  return apiFetch<Resources>("/api/v1/resources");
}

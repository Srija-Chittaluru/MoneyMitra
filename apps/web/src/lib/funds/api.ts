import { apiFetch } from "@/lib/api-client";
import type { EtfsResponse, MutualFundsResponse } from "./types";

export function getMutualFunds() {
  return apiFetch<MutualFundsResponse>("/api/v1/funds/mutual-funds");
}

export function getEtfs() {
  return apiFetch<EtfsResponse>("/api/v1/funds/etfs");
}

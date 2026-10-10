import { apiFetch } from "@/lib/api-client";
import type { RdRatesResponse } from "./types";

export function getRdRates() {
  return apiFetch<RdRatesResponse>("/api/v1/deposits/rd-rates");
}

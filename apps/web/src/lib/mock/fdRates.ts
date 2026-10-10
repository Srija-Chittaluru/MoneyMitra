/**
 * MOCK DATA — illustrative numbers only, used to develop the FD comparison chart.
 * These are NOT actual or current rates from any bank: the banks are generic
 * placeholders, and no effective date or source is given because there is none.
 * Replace with the FD-rates API when it exists (see lib/fd-rates/api.ts).
 */
import type { FdRate, FdTenure } from "@/lib/fd-rates/types";

const SAMPLE_BANKS: { id: string; name: string; rates: Record<FdTenure, number> }[] = [
  { id: "sample-a", name: "Sample Bank A", rates: { up_to_2y: 7.1, "2y_to_4y": 7.0, "4y_plus": 6.6 } },
  { id: "sample-b", name: "Sample Bank B", rates: { up_to_2y: 6.8, "2y_to_4y": 7.25, "4y_plus": 6.9 } },
  { id: "sample-c", name: "Sample Bank C", rates: { up_to_2y: 7.4, "2y_to_4y": 7.1, "4y_plus": 6.75 } },
  { id: "sample-d", name: "Sample Bank D", rates: { up_to_2y: 6.5, "2y_to_4y": 6.75, "4y_plus": 6.5 } },
  { id: "sample-e", name: "Sample Bank E", rates: { up_to_2y: 7.75, "2y_to_4y": 7.5, "4y_plus": 7.0 } },
  { id: "sample-f", name: "Sample Bank F", rates: { up_to_2y: 6.9, "2y_to_4y": 7.0, "4y_plus": 7.1 } },
  { id: "sample-g", name: "Sample Bank G", rates: { up_to_2y: 7.25, "2y_to_4y": 6.9, "4y_plus": 6.8 } },
  { id: "sample-h", name: "Sample Bank H", rates: { up_to_2y: 6.6, "2y_to_4y": 6.6, "4y_plus": 6.25 } },
];

export const MOCK_FD_RATES: FdRate[] = SAMPLE_BANKS.flatMap((bank) =>
  (Object.entries(bank.rates) as [FdTenure, number][]).map(([tenure, rate]) => ({
    bank_id: bank.id,
    bank_name: bank.name,
    tenure,
    annual_rate: rate,
    customer_category: "general" as const,
    effective_date: null,
    source_url: null,
  })),
);

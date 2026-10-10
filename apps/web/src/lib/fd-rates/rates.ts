/**
 * Real FD rates for 10 banks, general public, deposits under ₹3 crore, taken by
 * hand from each bank's own rate page (checked 10 Oct 2026; ICICI from two
 * agreeing news reports, as its page couldn't be read). Update the figures,
 * `effective_date` and `source_url` when a bank revises its rates.
 *
 * Each tenure group uses one representative tenure from the bank's table:
 * "Up to 2 years" = the 1-year rate, "2 to 4 years" = the 3-year rate,
 * "4 years and above" = the 5-year rate.
 */
import type { FdRate, FdTenure } from "./types";

const BANKS: { id: string; name: string; rates: Record<FdTenure, number>; effective: string; url: string }[] = [
  {
    id: "sbi",
    name: "SBI",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.3, "4y_plus": 6.05 },
    effective: "2025-12-15",
    url: "https://sbi.bank.in/web/interest-rates/deposit-rates/retail-domestic-term-deposits",
  },
  {
    id: "hdfc",
    name: "HDFC Bank",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.45, "4y_plus": 6.4 },
    effective: "2026-08-19",
    url: "https://www.hdfc.bank.in/fixed-deposit/fd-interest-rate",
  },
  {
    id: "icici",
    name: "ICICI Bank",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.45, "4y_plus": 6.5 },
    effective: "2025-12-29",
    url: "https://upstox.com/news/personal-finance/investing/recurring-deposit-interest-rate-in-july-2026-sbi-post-office-hdfc-icici-axis-kotak-compared/article-196456/",
  },
  {
    id: "axis",
    name: "Axis Bank",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.5, "4y_plus": 6.5 },
    effective: "2026-07-01",
    url: "https://www.axis.bank.in/docs/default-source/default-document-library/interest-rates/domestic-fixed-deposit-interest-rates-less-than-3-crores-08-october-2026.pdf",
  },
  {
    id: "indusind",
    name: "IndusInd Bank",
    rates: { up_to_2y: 6.75, "2y_to_4y": 7.0, "4y_plus": 6.65 },
    effective: "2026-07-24",
    url: "https://www.indusind.bank.in/in/en/personal/rates.html",
  },
  {
    id: "pnb",
    name: "Punjab National Bank",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.3, "4y_plus": 6.35 },
    effective: "2026-06-01",
    url: "https://pnb.bank.in/Interest-Rates-Deposit.html",
  },
  {
    id: "bob",
    name: "Bank of Baroda",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.25, "4y_plus": 6.3 },
    effective: "2026-06-12",
    url: "https://bankofbaroda.bank.in/interest-rate-and-service-charges/deposits-interest-rates/fixed-deposits-callable-and-non-callable-upto-ten-crores",
  },
  {
    id: "canara",
    name: "Canara Bank",
    rates: { up_to_2y: 6.25, "2y_to_4y": 6.25, "4y_plus": 6.25 },
    effective: "2026-03-17",
    url: "https://www.canarabank.bank.in/term-deposits-rate-of-interest-p.a.",
  },
  {
    id: "union",
    name: "Union Bank of India",
    rates: { up_to_2y: 6.2, "2y_to_4y": 6.1, "4y_plus": 6.0 },
    effective: "2026-08-04",
    url: "https://www.unionbankofindia.bank.in/en/details/rate-of-interest",
  },
  {
    id: "indian-bank",
    name: "Indian Bank",
    rates: { up_to_2y: 6.1, "2y_to_4y": 6.05, "4y_plus": 6.0 },
    effective: "2026-08-04",
    url: "https://indianbank.bank.in/departments/deposit-rates/",
  },
];

export const FD_RATES: FdRate[] = BANKS.flatMap((bank) =>
  (Object.entries(bank.rates) as [FdTenure, number][]).map(([tenure, rate]) => ({
    bank_id: bank.id,
    bank_name: bank.name,
    tenure,
    annual_rate: rate,
    customer_category: "general" as const,
    effective_date: bank.effective,
    source_url: bank.url,
  })),
);

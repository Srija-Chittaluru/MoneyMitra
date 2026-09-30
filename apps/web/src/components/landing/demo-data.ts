/**
 * DEMO DATA — marketing visuals only. Never connected to real user data,
 * the tax engine, or any API. Figures are illustrative but internally
 * consistent (FY 2025-26 slabs, ₹15,00,000 gross salary).
 */

const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function inr(amount: number): string {
  return inrFormatter.format(amount);
}

export const TAX = {
  year: "FY 2025-26",
  gross: 1500000,
  oldRegime: { taxable: 1155000, total: 165360 },
  newRegime: { taxable: 1425000, total: 97500 },
  savings: 67860,
} as const;

export interface TaxRow {
  label: string;
  old: number | null;
  new: number | null;
}

export const TAX_ROWS: TaxRow[] = [
  { label: "Gross salary", old: 1500000, new: 1500000 },
  { label: "Standard deduction", old: -50000, new: -75000 },
  { label: "Section 80C", old: -150000, new: null },
  { label: "Section 80D", old: -25000, new: null },
  { label: "HRA exemption", old: -120000, new: null },
];

export type DocTone = "success" | "warning" | "error";

export interface DemoDocument {
  name: string;
  detail: string;
  status: string;
  tone: DocTone;
}

export const DOCUMENTS: DemoDocument[] = [
  {
    name: "Form16_FY2025-26.pdf",
    detail: "12 fields extracted",
    status: "Extracted",
    tone: "success",
  },
  {
    name: "Payslip_Mar_2026.pdf",
    detail: "Salary, PF and TDS read",
    status: "Extracted",
    tone: "success",
  },
  {
    name: "ELSS_Statement.pdf",
    detail: "Couldn’t read this file — try a clearer copy",
    status: "Re-upload",
    tone: "error",
  },
  {
    name: "Rent receipts",
    detail: "Not uploaded yet",
    status: "Missing",
    tone: "warning",
  },
];

export const EXTRACTED_FIELDS = [
  { label: "Gross salary", value: inr(1500000) },
  { label: "TDS deducted", value: inr(97500) },
  { label: "Standard deduction", value: inr(75000) },
  { label: "Regime opted", value: "New" },
] as const;

export const RECOMMENDATIONS = [
  {
    title: "Stay on the new regime this year",
    reason: `Your eligible deductions fall short of the break-even point, so the new regime comes out ahead by an estimated ${inr(
      TAX.savings,
    )}.`,
    tag: "Regime",
  },
  {
    title: "Ask HR about employer NPS",
    reason:
      "Employer contributions under Section 80CCD(2) stay deductible even under the new regime.",
    tag: "Deduction",
  },
] as const;

export const FINANCE = {
  monthlyIncome: 102000,
  spent: 64000,
  saved: 38000,
  savingsRate: 37,
  months: [
    { label: "Apr", spent: 61000 },
    { label: "May", spent: 58000 },
    { label: "Jun", spent: 66000 },
    { label: "Jul", spent: 59000 },
    { label: "Aug", spent: 72000 },
    { label: "Sep", spent: 64000 },
  ],
  chartMax: 110000,
  categories: [
    { label: "Rent", amount: 28000 },
    { label: "Food & dining", amount: 12400 },
    { label: "Shopping", amount: 9200 },
    { label: "Bills & utilities", amount: 8800 },
    { label: "Transport", amount: 5600 },
  ],
  transactions: [
    { title: "Salary credit", subtitle: "Employer · 1 Sep", amount: 102000 },
    { title: "Monthly rent", subtitle: "Transfer · 3 Sep", amount: -28000 },
    { title: "Index fund SIP", subtitle: "Investment · 5 Sep", amount: -10000 },
  ],
} as const;

/**
 * MOCK DATA — illustrative numbers only. Real tax-slab calculation is
 * deterministic backend logic that ships in a later phase (Phase 3);
 * nothing here is computed.
 */
export interface RegimeBreakdown {
  grossIncome: number;
  standardDeduction: number;
  section80C: number;
  section80D: number;
  hraExemption: number;
  otherDeductions: number;
  taxableIncome: number;
  taxBeforeCess: number;
  cess: number;
  totalTax: number;
}

export interface MockTaxComparison {
  assessmentYear: string;
  oldRegime: RegimeBreakdown;
  newRegime: RegimeBreakdown;
  recommended: "old" | "new";
}

export const mockTaxComparison: MockTaxComparison = {
  assessmentYear: "AY 2026-27",
  oldRegime: {
    grossIncome: 1250000,
    standardDeduction: 50000,
    section80C: 150000,
    section80D: 25000,
    hraExemption: 96000,
    otherDeductions: 20000,
    taxableIncome: 909000,
    taxBeforeCess: 108700,
    cess: 4348,
    totalTax: 113048,
  },
  newRegime: {
    grossIncome: 1250000,
    standardDeduction: 75000,
    section80C: 0,
    section80D: 0,
    hraExemption: 0,
    otherDeductions: 0,
    taxableIncome: 1175000,
    taxBeforeCess: 74750,
    cess: 2990,
    totalTax: 77740,
  },
  recommended: "new",
};

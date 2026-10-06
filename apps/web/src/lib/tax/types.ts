export interface TaxComparisonInput {
  tax_year: string;
  gross_total_income: number;
  date_of_birth?: string;
  section_80c?: number;
  section_80d?: number;
  hra_exemption?: number;
  home_loan_interest?: number;
  nps_contribution?: number;
  other_deductions?: number;
}

export interface DeductionSectionBreakdown {
  section: string;
  label: string;
  limit: number | null;
  declared_amount: number;
  headroom: number | null;
  qualifying_instruments: string[];
  note: string | null;
}

export interface SlabContribution {
  lower: number;
  upper: number | null;
  rate: number;
  amount_in_band: number;
  tax: number;
}

export interface RegimeResult {
  regime: "old" | "new";
  gross_total_income: number;
  total_deductions: number;
  taxable_income: number;
  tax_before_rebate: number;
  rebate: number;
  tax_after_rebate: number;
  surcharge: number;
  cess: number;
  total_tax_payable: number;
  slab_breakdown: SlabContribution[];
}

export interface SlabRate {
  lower: number;
  upper: number | null;
  rate: number;
}

export interface SlabTable {
  tax_year: string;
  age_category: string;
  old_regime: SlabRate[];
  new_regime: SlabRate[];
}

export interface TaxComparisonResult {
  tax_year: string;
  old_regime: RegimeResult;
  new_regime: RegimeResult;
  recommended_regime: "old" | "new" | "either";
  difference: number;
  deduction_checklist: DeductionSectionBreakdown[];
}

export interface ExplanationResult {
  old_regime_note: string;
  new_regime_note: string;
  old_regime_disclaimer: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  comparison?: TaxComparisonResult;
  messages: ChatMessage[];
}

export interface ChatResponse {
  reply: string;
}

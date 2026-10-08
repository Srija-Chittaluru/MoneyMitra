/** Mirrors the backend FinanceOverview (GET /api/v1/finance/overview). */

export interface AmountLine {
  key: string;
  label: string;
  amount: number;
}

export interface FinanceIncome {
  total: number;
  lines: AmountLine[];
  monthly_take_home: number | null;
}

export interface FinanceTax {
  regime: "old" | "new";
  tax: number;
  effective_rate: number;
  other_regime_tax: number | null;
  savings: number | null;
  taxes_paid: number | null;
  refund_due: number | null;
  balance_payable: number | null;
}

export interface FinanceFiling {
  assessment_year: string;
  form: string;
  supported: boolean;
  due_date: string;
  is_belated: boolean;
  days_to_due: number;
  ready_to_file: boolean;
  open_items: number;
}

export interface FinanceInvestments {
  trades: number;
  sale_value: number;
  gains: AmountLine[];
  total_gain: number;
  trading: AmountLine[];
}

export interface TaxSavingSection {
  section: string;
  label: string;
  cap: number;
  declared: number;
  headroom: number;
}

export interface FinanceDocuments {
  uploaded: number;
  by_category: { category: string; label: string; count: number }[];
  missing: { category: string; title: string; why: string }[];
}

export interface FinanceAction {
  title: string;
  description: string;
  action_label: string;
  action_href: string;
}

export interface FinanceAlert {
  title: string;
  date: string;
  category: string;
}

export interface FinanceOverview {
  source: "itr_filing" | "tax_comparison" | null;
  financial_year: string | null;
  updated_at: string | null;
  income: FinanceIncome | null;
  tax: FinanceTax | null;
  filing: FinanceFiling | null;
  investments: FinanceInvestments | null;
  tax_saving: TaxSavingSection[];
  tax_saving_year: string;
  tax_saving_note: string;
  documents: FinanceDocuments;
  actions: FinanceAction[];
  alerts: FinanceAlert[];
}

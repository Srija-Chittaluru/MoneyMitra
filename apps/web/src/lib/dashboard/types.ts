export type RegimeChoice = "old" | "new" | "either";

/** Where the user's income and tax figures were taken from. */
export type SummarySource = "itr_filing" | "tax_comparison";

export interface RegimeSummary {
  old_tax: number;
  new_tax: number;
  better: RegimeChoice;
  difference: number;
}

export interface EstimatedTax {
  regime: "old" | "new";
  amount: number;
}

/**
 * What MoneyMitra actually knows about the user's money. Every field is null
 * until the user has provided the data it is calculated from.
 */
export interface DashboardSummary {
  source: SummarySource | null;
  annual_income: number | null;
  /** Tax and cess under the better regime (or the only one that applies), before any interest or late fee. */
  estimated_tax: EstimatedTax | null;
  /** The old-vs-new comparison; null when both regimes can't be compared for this return. */
  regime: RegimeSummary | null;
  /** Why `regime` is null although income is known: the old regime is closed for a late return. */
  regime_unavailable_reason: "old_regime_closed" | null;
  updated_at: string | null;
}

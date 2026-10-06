/**
 * MOCK DATA — illustrative demo content only. Not personalized advice.
 * Only the Dashboard's "Recommendations for you" card still uses this; the
 * Recommendations page itself is backed by the real engine.
 */
export interface MockTaxSavingRecommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  category: string;
  actionLabel: string;
}

export const mockTaxSavingRecommendations: MockTaxSavingRecommendation[] = [
  {
    id: "ts1",
    title: "Top up your Section 80C investments",
    description: "You've used ₹95,000 of the ₹1,50,000 80C limit this year.",
    reason: "Based on your Form 16 and tax proofs, you have ₹55,000 of unused 80C headroom under the old regime.",
    category: "Section 80C",
    actionLabel: "See eligible instruments",
  },
  {
    id: "ts2",
    title: "Claim HRA exemption",
    description: "Your payslips show HRA paid, but no rent receipts uploaded yet.",
    reason: "Uploading rent receipts could reduce your taxable income by up to ₹96,000 under the old regime.",
    category: "HRA",
    actionLabel: "Upload rent receipts",
  },
  {
    id: "ts3",
    title: "Consider the new regime this year",
    description: "Based on your current deductions, the new regime saves you an estimated ₹35,308.",
    reason: "Your total eligible deductions are lower than the new regime's break-even point.",
    category: "Regime choice",
    actionLabel: "View full comparison",
  },
];

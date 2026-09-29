/**
 * MOCK DATA — illustrative demo content only. Not personalized advice.
 * Real recommendation logic ships in Phase 5.
 */
export interface MockTaxSavingRecommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  category: string;
  actionLabel: string;
}

export interface MockLifeStageRecommendation {
  id: string;
  title: string;
  description: string;
  reason: string;
  stage: "Career Start" | "Mid-Career" | "Pre-Retirement";
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

export const mockLifeStageRecommendations: MockLifeStageRecommendation[] = [
  {
    id: "ls1",
    title: "Build a 6-month emergency fund",
    description: "Keep 6 months of expenses in a liquid fund or savings account.",
    reason: "You're early in your career — a safety net matters more than optimizing returns right now.",
    stage: "Career Start",
    actionLabel: "Learn more",
  },
  {
    id: "ls2",
    title: "Review your health insurance cover",
    description: "Consider increasing cover as income and responsibilities grow.",
    reason: "Your income has grown, but your insurance profile hasn't been updated in a while.",
    stage: "Mid-Career",
    actionLabel: "Review coverage",
  },
  {
    id: "ls3",
    title: "Shift toward capital preservation",
    description: "Gradually rebalance from equity-heavy investments to safer instruments.",
    reason: "As retirement approaches, protecting accumulated savings matters more than growth.",
    stage: "Pre-Retirement",
    actionLabel: "Review portfolio mix",
  },
];

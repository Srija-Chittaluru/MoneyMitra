/**
 * MOCK DATA — for UI prototyping only. Real finance-management logic
 * (predict/recommend/invest/insights) ships progressively in Phase 6.
 */
export interface MockSpendingCategory {
  category: string;
  amount: number;
}

export const mockSpendingSummary: MockSpendingCategory[] = [
  { category: "Groceries", amount: 8200 },
  { category: "Utilities", amount: 4100 },
  { category: "Subscriptions", amount: 1900 },
  { category: "Insurance", amount: 12000 },
  { category: "Transfers", amount: 6400 },
];

export const mockSavingsInsights = [
  {
    id: "si1",
    title: "Subscriptions crept up 18% this quarter",
    description: "Netflix, a music service, and one unused subscription add up to ₹1,900/month.",
  },
  {
    id: "si2",
    title: "You're on track for your emergency fund goal",
    description: "At the current savings rate, you'll hit 6 months of expenses saved by March.",
  },
];

export const mockFinanceTaxOverview = {
  estimatedAnnualTax: 77740,
  regime: "new" as const,
  nextDeadline: "2027-07-31",
};

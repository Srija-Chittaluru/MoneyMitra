/**
 * MOCK DATA — for UI prototyping only. Not connected to any real account
 * or backend. Replace with real API data once the finance APIs exist.
 */
export interface MockTransaction {
  id: string;
  initial: string;
  title: string;
  subtitle: string;
  amount: number;
  category: string;
  date: string;
}

export const mockTransactions: MockTransaction[] = [
  { id: "t1", initial: "S", title: "Salary · Acme Inc", subtitle: "Today · Deposit", amount: 104200, category: "Income", date: "2026-09-29" },
  { id: "t2", initial: "W", title: "Whole Foods", subtitle: "Yesterday · Groceries", amount: -2860.4, category: "Groceries", date: "2026-09-28" },
  { id: "t3", initial: "N", title: "Netflix", subtitle: "Sep 24 · Subscription", amount: -649, category: "Subscriptions", date: "2026-09-24" },
  { id: "t4", initial: "J", title: "Jamie Chen", subtitle: "Sep 22 · Transfer", amount: -3200, category: "Transfer", date: "2026-09-22" },
  { id: "t5", initial: "L", title: "LIC Premium", subtitle: "Sep 18 · Insurance", amount: -12000, category: "Insurance", date: "2026-09-18" },
  { id: "t6", initial: "E", title: "Electricity Board", subtitle: "Sep 12 · Utilities", amount: -1840, category: "Utilities", date: "2026-09-12" },
];

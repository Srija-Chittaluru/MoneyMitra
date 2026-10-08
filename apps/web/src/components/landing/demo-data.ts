/**
 * DEMO DATA — marketing visuals only. Never connected to real user data,
 * the tax engine, or any API. Figures are illustrative but internally
 * consistent (FY 2026-27 slabs, ₹18,40,000 gross salary) across every
 * section of the landing page.
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
  year: "FY 2026-27",
  gross: 1840000,
  deductions: 757000,
  taxable: 1083000,
  oldRegime: { total: 142800 },
  newRegime: { total: 159120 },
  /** Old regime is cheaper than new by this much, for this income/deductions. */
  regimeDifference: 16320,
  /** Extra savings available this year from the two actions in TAX_ACTIONS. */
  potentialSavings: 18400,
  taxAfterActions: 124400,
} as const;

export const DEDUCTION_CHIPS = [
  { label: "Standard", value: "₹50,000" },
  { label: "80C", value: "₹1,50,000" },
  { label: "80D", value: "₹25,000" },
  { label: "HRA", value: "₹3,20,000" },
  { label: "Home loan 24(b)", value: "₹2,00,000" },
  { label: "Others", value: "₹12,000" },
] as const;

export interface TaxAction {
  title: string;
  detail: string;
  /** Rupees saved by taking this action; null means it's already fully used. */
  saved: number | null;
}

export const TAX_ACTIONS: TaxAction[] = [
  { title: "Invest ₹50,000 in NPS", detail: "Section 80CCD(1B) · over and above 80C", saved: 15600 },
  { title: "Cover your parents' health premium", detail: "Section 80D · ₹9,000 premium", saved: 2800 },
  { title: "80C limit", detail: "ELSS, EPF and insurance", saved: null },
];

export const MONEY = {
  income: 75000,
  spending: 42600,
  available: 32400,
  invested: 482000,
  investedChangeThisMonth: 8420,
} as const;

/** Illustrative bar heights (0-100), not rupee figures. */
export const CASH_FLOW = [
  { label: "MAY", income: 94, spending: 58 },
  { label: "JUN", income: 94, spending: 56 },
  { label: "JUL", income: 94, spending: 60 },
  { label: "AUG", income: 94, spending: 54 },
  { label: "SEP", income: 94, spending: 57 },
  { label: "OCT", income: 94, spending: 53 },
] as const;

export const ALLOCATION = {
  current: { equity: 82, debt: 12, gold: 6 },
  plan: { equity: 65, debt: 25, gold: 10 },
} as const;

export const GOALS = [
  { label: "Emergency fund", saved: 128000, target: 255600 },
  { label: "Home down payment", saved: 360000, target: 2000000 },
  { label: "Europe trip", saved: 192000, target: 300000 },
] as const;

export interface ScatteredSource {
  label: string;
  tag?: string;
  tagTone?: "neutral" | "warning";
  detail: string;
  value: string;
}

export const SCATTERED_SOURCES: ScatteredSource[] = [
  { label: "Payslip", tag: "SEP 2026", detail: "Net pay", value: "₹75,000" },
  { label: "Form 16", tag: "FY 25–26", detail: "Part B · Gross salary", value: "₹18,40,000" },
  { label: "Bank statement", tag: "••4821", detail: "214 transactions", value: "−₹42,600" },
  { label: "Investment account", detail: "6 mutual funds", value: "₹4,82,000" },
  { label: "Insurance", tag: "HEALTH", detail: "Self · ₹5L cover", value: "₹14,200/yr" },
  { label: "Bills", tag: "DUE 12 OCT", tagTone: "warning", detail: "Electricity", value: "₹2,340" },
  { label: "Tax portal", tag: "AIS · 26AS", detail: "TDS credited", value: "₹1,38,400" },
];

export interface Persona {
  initial: string;
  name: string;
  role: string;
  age: string;
  facts: { k: string; v: string }[];
  line1: string;
  line2: string;
  big: string;
  sub: string;
  action: string;
}

export const PERSONAS: Persona[] = [
  {
    initial: "R",
    name: "Rohan",
    role: "First job · Pune",
    age: "22",
    facts: [
      { k: "In-hand salary", v: "₹38,000/mo" },
      { k: "Monthly spending", v: "₹27,500" },
      { k: "Bike goal", v: "₹1,40,000" },
    ],
    line1: "You're planning to buy a bike in 18 months.",
    line2: "Here's what you can set aside each month.",
    big: "₹6,000/month",
    sub: "Still leaves ₹4,500 free every month.",
    action: "Start saving",
  },
  {
    initial: "M",
    name: "Meera",
    role: "Product manager · Bengaluru",
    age: "32",
    facts: [
      { k: "Spent this month", v: "₹61,000" },
      { k: "Usual by now", v: "₹68,000" },
      { k: "Marriage fund", v: "₹2,52,000 of ₹6L" },
    ],
    line1: "You're spending less than expected this month.",
    line2: "₹7,000 could be redirected toward your marriage fund.",
    big: "₹7,000",
    sub: "Moves the fund from 42% to 43%.",
    action: "Redirect ₹7,000",
  },
  {
    initial: "V",
    name: "Vikram",
    role: "Two children · Gurugram",
    age: "40",
    facts: [
      { k: "Education SIP", v: "₹12,000/mo" },
      { k: "Goal by 2034", v: "₹25,00,000" },
      { k: "Projected", v: "₹22,90,000" },
    ],
    line1: "Your child's education goal is 8 years away.",
    line2: "You're currently ₹2,10,000 behind your projected target.",
    big: "+₹1,500/month",
    sub: "Raising your SIP closes the gap by 2034.",
    action: "Adjust SIP",
  },
];

export interface Milestone {
  monthIndex: number; // 0 = January
  month: string;
  title: string;
  desc: string;
  label: string;
  value: string;
  insight: string;
  action: string;
}

export const MONTH_ABBR = [
  "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
] as const;

export const MILESTONES: Milestone[] = [
  {
    monthIndex: 0,
    month: "JANUARY",
    title: "Tax planning",
    desc: "Mitra checks what you've invested against every deduction you're eligible for, while there's still time to act.",
    label: "Deduction gap",
    value: "₹50,000",
    insight: "NPS under 80CCD(1B) is unused. 10 weeks left before 31 March.",
    action: "Plan investment",
  },
  {
    monthIndex: 2,
    month: "MARCH",
    title: "Investment review",
    desc: "Before the financial year closes, Mitra reviews how far your portfolio has drifted from your plan.",
    label: "Allocation drift",
    value: "82% equity",
    insight: "Your plan says 65%. Moving ₹82,000 to debt brings you back in line.",
    action: "See rebalance plan",
  },
  {
    monthIndex: 3,
    month: "APRIL",
    title: "Tax filing",
    desc: "Your Form 16, AIS and 26AS are matched line by line, so filing is a quick check rather than a project.",
    label: "Documents matched",
    value: "3 of 3",
    insight: "No mismatches found. A refund of ₹4,200 is expected.",
    action: "Review return",
  },
  {
    monthIndex: 5,
    month: "JUNE",
    title: "Spending analysis",
    desc: "Mitra compares this quarter with your usual pattern and points out what changed.",
    label: "Above your usual",
    value: "₹3,100/mo",
    insight: "Food delivery is up 18% over the last three months.",
    action: "See breakdown",
  },
  {
    monthIndex: 8,
    month: "SEPTEMBER",
    title: "Goal progress",
    desc: "Every goal is measured against what you actually save each month, not a calculator assumption.",
    label: "Emergency fund",
    value: "3 of 6 months",
    insight: "On track to reach 6 months of expenses by March 2027.",
    action: "View goals",
  },
  {
    monthIndex: 11,
    month: "DECEMBER",
    title: "Year-end financial review",
    desc: "A plain summary of your year, and the moves that matter most for the next one.",
    label: "Tax saved this year",
    value: "₹18,400",
    insight: "Plus ₹1,80,000 invested through SIPs across 6 funds.",
    action: "Open review",
  },
];

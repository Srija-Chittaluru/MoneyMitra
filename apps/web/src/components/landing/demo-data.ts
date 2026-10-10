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

/**
 * Shaped like the real /finance overview (lib/finance/types.ts) and the real
 * dashboard's 3 stat cards — this is what the Hero and "Your financial
 * picture" mockups render, so the landing page shows the product MoneyMitra
 * actually is (tax, documents, regime comparison), not an invented
 * budgeting/goals app.
 */
export const FINANCE_PREVIEW = {
  incomeLines: [
    { label: "Salary (Form 16)", value: 1750000 },
    { label: "Interest income", value: 90000 },
  ],
  monthlyTakeHome: 112000,
  effectiveRate: 7.8,
  refundDue: 4200,
  taxSaving: [
    { label: "Section 80C", cap: 150000, declared: 150000 },
    { label: "Section 80D (health insurance)", cap: 25000, declared: 15000 },
    { label: "Section 24(b) (home loan interest)", cap: 200000, declared: 150000 },
    { label: "Section 80CCD(1B) (NPS)", cap: 50000, declared: 0 },
  ],
  filing: {
    form: "ITR-1",
    assessmentYear: "2026-27",
    readyToFile: true,
  },
} as const;

/** Mirrors Recommendation's real shape (category drives the icon on both the dashboard and this page). */
export const DASHBOARD_RECOMMENDATIONS = [
  {
    category: "tax_saving" as const,
    title: "Invest ₹50,000 in NPS",
    description: "Section 80CCD(1B), over and above your 80C limit — saves ₹15,600 this year.",
  },
  {
    category: "life_stage" as const,
    title: "Don't leave idle money in a savings account",
    description: "Above your emergency fund, a savings account earns less than prices rise. Move it to work harder.",
  },
];

export interface ScatteredSource {
  label: string;
  tag?: string;
  tagTone?: "neutral" | "warning";
  detail: string;
  value: string;
  /** Scattered offset from center (px) and rotation (deg), matching the mockup's converging layout. */
  x: number;
  y: number;
  r: number;
}

export const SCATTERED_SOURCES: ScatteredSource[] = [
  { label: "Payslip", tag: "SEP 2026", detail: "Net pay", value: "₹75,000", x: -560, y: -150, r: -5 },
  { label: "Form 16", tag: "FY 25–26", detail: "Part B · Gross salary", value: "₹18,40,000", x: -350, y: 150, r: 4 },
  { label: "Bank statement", tag: "••4821", detail: "214 transactions", value: "−₹42,600", x: 340, y: -170, r: 3 },
  { label: "Investment account", detail: "6 mutual funds", value: "₹4,82,000", x: 590, y: -10, r: -4 },
  { label: "Insurance", tag: "HEALTH", detail: "Self · ₹5L cover", value: "₹14,200/yr", x: -40, y: 240, r: -2 },
  { label: "Bills", tag: "DUE 12 OCT", tagTone: "warning", detail: "Electricity", value: "₹2,340", x: -620, y: 200, r: 6 },
  { label: "Tax portal", tag: "AIS · 26AS", detail: "TDS credited", value: "₹1,38,400", x: 420, y: 210, r: -3 },
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

/**
 * Each persona mirrors a real life-stage recommendation the engine actually
 * produces (app/modules/recommendations/life_stage.py) — start_investing,
 * idle_money/emergency_fund, and goal_investing — as the one-time worked
 * illustration the engine gives, not an ongoing progress tracker (MoneyMitra
 * doesn't track spending or goal balances over time).
 */
export const PERSONAS: Persona[] = [
  {
    initial: "R",
    name: "Rohan",
    role: "First job · Pune",
    age: "22",
    facts: [
      { k: "In-hand salary", v: "₹38,000/mo" },
      { k: "Investing so far", v: "Not started" },
      { k: "Years to retirement", v: "~38" },
    ],
    line1: "You haven't started investing yet.",
    line2: "At your age, time does most of the work — starting small beats starting late.",
    big: "₹1,05,00,000",
    sub: "from ₹3,000/month for 30 years (you'd put in ₹10,80,000 of that)",
    action: "Start a SIP",
  },
  {
    initial: "M",
    name: "Meera",
    role: "Product manager · Bengaluru",
    age: "32",
    facts: [
      { k: "Monthly income", v: "₹95,000" },
      { k: "Savings-account balance", v: "~₹4,20,000" },
      { k: "Emergency fund target", v: "₹3,80,000" },
    ],
    line1: "You have money sitting idle above your emergency fund.",
    line2: "A savings account pays less than prices rise — a fixed deposit or fund earns more.",
    big: "+₹14,000/year",
    sub: "by moving ₹40,000 from a savings account (3.5%) to a safer fund (7%)",
    action: "See where it can go",
  },
  {
    initial: "V",
    name: "Vikram",
    role: "Two children · Gurugram",
    age: "40",
    facts: [
      { k: "Children", v: "2" },
      { k: "Education goal", v: "₹25,00,000" },
      { k: "Years away", v: "10" },
    ],
    line1: "Your child's education goal is 10 years away.",
    line2: "Giving it its own monthly number, in its own timeline, keeps it on track.",
    big: "₹14,500/month",
    sub: "in growth investments reaches ₹25,00,000 in 10 years",
    action: "See the full plan",
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
    title: "Last call for this year's deductions",
    desc: "In the final weeks of the financial year, Mitra shows exactly how much deduction headroom is still unused.",
    label: "80C headroom left",
    value: "₹45,000",
    insight: "About ₹22,500/month for the next 2 months closes it before 31 March.",
    action: "See your tax plan",
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
    title: "Recommendations refresh",
    desc: "As new payslips and documents arrive, Mitra re-checks what advice they unlock.",
    label: "Recommendation level",
    value: "2 of 3",
    insight: "Add your Form 16 or AIS to unlock advice built on your own documents.",
    action: "View recommendations",
  },
  {
    monthIndex: 8,
    month: "SEPTEMBER",
    title: "Mid-year tax check-in",
    desc: "Halfway through the year, Mitra flags which deduction sections need attention before they're forgotten.",
    label: "80CCD(1B) headroom",
    value: "₹50,000",
    insight: "Still fully unused, with 6 months left to invest in NPS.",
    action: "See your tax plan",
  },
  {
    monthIndex: 11,
    month: "DECEMBER",
    title: "Year-end tax planning",
    desc: "A plain summary of what's left to use before the financial year closes.",
    label: "Deduction headroom used",
    value: "₹3,20,000 of ₹4,25,000",
    insight: "3 months left before 31 March — the rest can still be used.",
    action: "Review your sections",
  },
];

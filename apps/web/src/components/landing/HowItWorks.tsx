import { cn } from "@/lib/cn";
import { TAX, inr } from "./demo-data";
import { Amount, Container, Eyebrow } from "./parts";

function StepLabel({ children, accent }: { children: string; accent?: boolean }) {
  return (
    <p className={cn("font-mono text-xs tracking-wide", accent ? "text-accent-text" : "text-muted")}>{children}</p>
  );
}

function DataStep() {
  const rows = [
    { label: "Form 16 · Gross", value: inr(TAX.gross) },
    { label: "Salary · in-hand", value: "₹75,000/mo" },
    { label: "80C invested", value: "₹1,50,000" },
    { label: "NPS", value: "₹0" },
    { label: "Health cover", value: "Self only" },
  ];
  return (
    <div className="flex h-full flex-col gap-2 rounded-lg border border-line bg-surface p-5">
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between rounded-md bg-field px-3 py-2.5 text-xs">
          <span className="text-muted">{row.label}</span>
          <Amount className="text-foreground">{row.value}</Amount>
        </div>
      ))}
    </div>
  );
}

function UnderstandingStep() {
  const insights = [
    "Old regime is better for you by ₹16,320",
    "₹50,000 NPS deduction unused under 80CCD(1B)",
    "Parents' health premium can be claimed under 80D",
  ];
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      {insights.map((line) => (
        <p key={line} className="flex gap-2 text-sm text-foreground">
          <span className="text-accent-text">→</span>
          {line}
        </p>
      ))}
      <div className="mt-auto border-t border-line pt-4">
        <p className="text-xs text-muted">Potential tax saving</p>
        <Amount className="mt-1 block text-3xl font-semibold tracking-tight text-accent-text">
          {inr(TAX.potentialSavings)}
        </Amount>
      </div>
    </div>
  );
}

function RecommendationStep() {
  return (
    <div className="flex h-full flex-col gap-3 rounded-lg border border-line bg-surface p-5">
      <p className="flex items-center gap-2 text-xs text-accent-text">Recommended next move</p>
      <p className="text-lg leading-tight tracking-tight text-foreground">
        Put the {inr(TAX.potentialSavings)} you save to work where it matters most right now.
      </p>
      <div className="mt-auto flex flex-col gap-2">
        <p className="text-xs text-muted">Why</p>
        <div className="flex justify-between text-xs text-muted">
          <span>Emergency fund</span>
          <span className="text-foreground">3 of 6 months</span>
        </div>
        <div className="h-1.5 rounded-full bg-field">
          <div className="h-full w-1/2 rounded-full bg-accent" />
        </div>
        <div className="flex justify-between text-xs text-muted">
          <span>Free each month</span>
          <span className="text-foreground">₹32,400</span>
        </div>
      </div>
    </div>
  );
}

function ActionStep() {
  return (
    <div className="flex h-full flex-col gap-4 rounded-lg border border-accent/40 bg-surface p-5 shadow-[0_0_40px_-20px_var(--color-accent)]">
      <p className="text-lg font-semibold leading-tight tracking-tight text-foreground">
        Allocate ₹10,000/month toward your emergency fund.
      </p>
      <div className="flex items-center justify-between rounded-md bg-field px-3 py-2.5 text-xs text-foreground">
        <span>Auto-transfer on the 2nd</span>
        <span className="relative inline-block h-5 w-9 rounded-full bg-accent">
          <span className="absolute right-0.5 top-0.5 h-4 w-4 rounded-full bg-accent-foreground" />
        </span>
      </div>
      <p className="text-xs text-muted">Reaches 6 months of expenses by March 2027.</p>
      <div className="mt-auto flex h-11 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
        Set it up
      </div>
    </div>
  );
}

const STEPS = [
  { label: "01 · DATA", Component: DataStep },
  { label: "02 · UNDERSTANDING", Component: UnderstandingStep },
  { label: "03 · RECOMMENDATION", Component: RecommendationStep },
  { label: "04 · ACTION", Component: ActionStep, accent: true },
];

export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8 md:mb-16">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Eyebrow>03 · From information to action</Eyebrow>
            <h2 className="text-h1 md:text-[44px]">
              Numbers in.
              <br />
              <span className="text-muted">A clear move out.</span>
            </h2>
          </div>
          <p data-reveal className="max-w-sm text-body text-muted md:text-lg">
            MoneyMitra doesn&apos;t stop at showing your data. It works out what the numbers mean for you,
            then turns that into one thing you can act on.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {STEPS.map(({ label, Component, accent }) => (
            <div key={label} data-reveal className="flex flex-col gap-3">
              <StepLabel accent={accent}>{label}</StepLabel>
              <Component />
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

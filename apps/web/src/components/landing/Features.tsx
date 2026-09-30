import type { ReactNode } from "react";
import { FileText, Scale, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  EXTRACTED_FIELDS,
  FINANCE,
  RECOMMENDATIONS,
  TAX,
  inr,
} from "./demo-data";
import { Amount, Container, Eyebrow, Pill, RegimeBars } from "./parts";

function FeatureCard({
  icon: Icon,
  title,
  headline,
  benefit,
  className,
  children,
}: {
  icon: LucideIcon;
  title: string;
  headline: string;
  benefit: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={cn(
        "flex flex-col gap-6 rounded-lg border border-border bg-surface p-6 md:p-8",
        className,
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-muted">
          <Icon className="h-4 w-4 text-link" strokeWidth={1.75} />
          {title}
        </div>
        <h3 className="text-h2">{headline}</h3>
        <p className="text-body text-muted">{benefit}</p>
      </div>
      <div
        aria-hidden
        className="mt-auto rounded-md border border-border bg-background p-4"
      >
        {children}
      </div>
    </article>
  );
}

function ComparisonVisual() {
  return (
    <div className="flex flex-col gap-4">
      <RegimeBars />
      <div className="flex items-center justify-between border-t border-border pt-3 text-xs">
        <span className="text-muted">Difference under the new regime</span>
        <Amount className="text-success">−{inr(TAX.savings)}</Amount>
      </div>
    </div>
  );
}

function ExtractionVisual() {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-xs">
        <FileText className="h-4 w-4 text-muted" strokeWidth={1.75} />
        <span className="truncate font-medium text-foreground">
          Form16_FY2025-26.pdf
        </span>
        <Pill tone="success" className="ml-auto">
          Extracted
        </Pill>
      </div>
      <dl className="grid grid-cols-2 gap-2">
        {EXTRACTED_FIELDS.map(({ label, value }) => (
          <div
            key={label}
            className="min-w-0 rounded-md border border-border bg-surface px-2.5 py-2"
          >
            <dt className="truncate text-[10px] text-muted">{label}</dt>
            <dd className="mt-0.5 truncate font-mono text-xs font-medium text-foreground">
              {value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function RecommendationVisual() {
  const rec = RECOMMENDATIONS[1];
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-foreground">{rec.title}</p>
        <Pill tone="neutral">{rec.tag}</Pill>
      </div>
      <p className="rounded-md bg-surface-muted p-2.5 text-[11px] leading-4 text-muted">
        <span className="font-semibold text-foreground">Why: </span>
        {rec.reason}
      </p>
    </div>
  );
}

function FinanceVisual() {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:gap-6">
      <div className="grid shrink-0 grid-cols-2 gap-4 lg:w-40 lg:grid-cols-1 lg:gap-3">
        <div>
          <p className="text-[11px] text-muted">Saved this month</p>
          <Amount className="text-base text-foreground">
            {inr(FINANCE.saved)}
          </Amount>
        </div>
        <div>
          <p className="text-[11px] text-muted">Savings rate</p>
          <Amount className="text-base text-foreground">
            {FINANCE.savingsRate}%
          </Amount>
        </div>
      </div>
      <div className="flex h-24 min-w-0 flex-1 items-end gap-2">
        {FINANCE.months.map((m, i) => (
          <div key={m.label} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex h-20 w-full items-end">
              <div
                className={cn(
                  "w-full rounded-sm",
                  i === FINANCE.months.length - 1 ? "bg-link" : "bg-foreground/15",
                )}
                style={{ height: `${(m.spent / FINANCE.chartMax) * 100}%` }}
              />
            </div>
            <span className="text-[10px] text-muted">{m.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section
      id="features"
      className="scroll-mt-20 pb-20 md:pb-28"
    >
      <Container>
        <div className="mb-10 flex max-w-2xl flex-col gap-3 md:mb-14">
          <Eyebrow>Features</Eyebrow>
          <h2 className="text-h1 md:text-[40px]">
            Everything your salary touches, made clear.
          </h2>
          <p className="text-body text-muted">
            Four tools that work together, so you spend less time decoding
            forms and more time making confident decisions.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-12 md:gap-5">
          <FeatureCard
            className="md:col-span-7"
            icon={Scale}
            title="Old vs. new tax comparison"
            headline="Know which regime costs you less."
            benefit="We run both regimes on your actual numbers and show the gap to the rupee — no spreadsheets, no guesswork before you declare to your employer."
          >
            <ComparisonVisual />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-5"
            icon={FileText}
            title="Document intelligence"
            headline="Upload once. We read the rest."
            benefit="Drop in payslips, Form 16 and proofs. MoneyMitra pulls out salary, TDS and deductions so you never retype a figure."
          >
            <ExtractionVisual />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-5"
            icon={Sparkles}
            title="Tax-saving recommendations"
            headline="Advice that shows its work."
            benefit="Every suggestion comes with the reason behind it, based on your income and deductions — not a generic list of tips."
          >
            <RecommendationVisual />
          </FeatureCard>

          <FeatureCard
            className="md:col-span-7"
            icon={Wallet}
            title="Finance management"
            headline="Taxes are one part of the picture."
            benefit="See spending, investments and savings next to your tax position, so every money decision comes with context."
          >
            <FinanceVisual />
          </FeatureCard>
        </div>
      </Container>
    </section>
  );
}

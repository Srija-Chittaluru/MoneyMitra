"use client";

import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { useTaxDeadline } from "@/lib/useTaxDeadline";
import { DEDUCTION_CHIPS, TAX, TAX_ACTIONS, inr } from "./demo-data";
import { Amount, Container, Eyebrow, PhotoBackground, RegimeBars } from "./parts";

function TaxBreakdown() {
  const bars = [
    { label: "Income", value: TAX.gross, height: 100, tone: "bg-surface-muted dark:bg-[#283548]" },
    { label: "Deductions", value: TAX.deductions, height: 41, tone: "bg-surface-muted dark:bg-[#344054]" },
    { label: "Taxable", value: TAX.taxable, height: 59, tone: "bg-surface-muted dark:bg-[#283548]" },
    { label: "Tax", value: TAX.oldRegime.total, height: 18, tone: "bg-accent", accent: true },
  ];
  return (
    <div className="rounded-lg border border-line bg-card p-5">
      <div className="mb-5 flex items-center justify-between text-sm">
        <span className="text-foreground">How your tax adds up</span>
        <span className="font-mono text-[11px] text-muted">{TAX.year} · Estimate</span>
      </div>
      <div className="grid grid-cols-4 items-end gap-3">
        {bars.map((bar) => (
          <div key={bar.label}>
            <p className={cn("mb-2 text-xs", bar.accent ? "text-accent-text" : "text-muted")}>{bar.label}</p>
            <div className={cn("rounded-md", bar.tone)} style={{ height: `${Math.max(bar.height, 12)}px` }} />
            <Amount className={cn("mt-2 block text-xs", bar.accent && "text-accent-text")}>{inr(bar.value)}</Amount>
          </div>
        ))}
      </div>
      <div className="mt-5 flex flex-wrap gap-2">
        {DEDUCTION_CHIPS.map((chip) => (
          <span key={chip.label} className="rounded-md bg-surface-muted px-2.5 py-1.5 text-xs text-muted dark:bg-[#283548]">
            {chip.label} {chip.value}
          </span>
        ))}
      </div>
    </div>
  );
}

function WaysToPayLess() {
  const { days: daysToDeadline } = useTaxDeadline();
  return (
    <div className="flex h-full flex-col rounded-lg border border-line bg-card p-5">
      <div className="mb-4 flex items-center justify-between text-sm">
        <span className="text-foreground">Ways to pay less this year</span>
        <span className="font-mono text-[11px] text-muted">{daysToDeadline} days to 31 March</span>
      </div>
      <div className="flex flex-col gap-2.5">
        {TAX_ACTIONS.map((action) =>
          action.saved === null ? (
            <div key={action.title} className="flex items-center justify-between gap-3 rounded-md bg-field p-3.5">
              <div>
                <p className="text-sm font-medium text-muted">{action.title}</p>
                <p className="mt-0.5 text-xs text-muted">{action.detail}</p>
              </div>
              <span className="flex shrink-0 items-center gap-1 text-xs text-link">
                <CheckCircle2 className="h-3.5 w-3.5" /> Fully used
              </span>
            </div>
          ) : (
            <div
              key={action.title}
              className="flex items-start justify-between gap-3 rounded-md border border-accent/30 bg-accent/10 p-3.5"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{action.title}</p>
                <p className="mt-0.5 text-xs text-muted">{action.detail}</p>
              </div>
              <div className="shrink-0 text-right">
                <Amount className="block text-accent-text">{inr(action.saved)}</Amount>
                <p className="text-[10px] text-muted">saved</p>
              </div>
            </div>
          ),
        )}
      </div>
      <div className="mt-auto flex flex-wrap items-end justify-between gap-3 border-t border-line pt-5">
        <div>
          <p className="text-xs text-muted">Tax after both actions</p>
          <div className="mt-1 flex items-baseline gap-2">
            <Amount className="text-2xl font-semibold tracking-tight text-foreground">
              {inr(TAX.taxAfterActions)}
            </Amount>
            <span className="font-mono text-xs text-muted line-through">{inr(TAX.oldRegime.total)}</span>
          </div>
        </div>
        <div className="flex h-11 items-center rounded-md bg-accent px-5 text-sm font-semibold text-accent-foreground">
          Review both actions
        </div>
      </div>
    </div>
  );
}

export function Features() {
  return (
    <section id="tax" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8 md:mb-16">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Eyebrow>04 · Tax</Eyebrow>
            <h2 className="text-h1 md:text-[44px]">
              Save on taxes.
              <br />
              <span className="text-muted">Keep more of your money.</span>
            </h2>
          </div>
          <p data-reveal className="max-w-sm text-body text-muted md:text-lg">
            See how your tax is calculated, which regime suits you, and what you can still do this year to
            pay less. Before the deadline, not after.
          </p>
        </div>

        <div
          data-reveal
          className="relative isolate overflow-hidden rounded-[28px] border-[6px] border-line bg-field p-4 shadow-[0_60px_120px_-50px_rgba(0,0,0,0.9)] dark:border-black sm:p-6"
        >
          <PhotoBackground
            src="/landing/pixel-sky.png"
            objectPosition="50% 100%"
            sizes="(max-width: 1024px) 100vw, 1360px"
            className="hidden -z-10 dark:block"
          />
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/60 to-background/30" />

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="flex flex-col gap-5">
              <TaxBreakdown />
              <div className="rounded-lg border border-line bg-card p-5">
                <p className="mb-4 text-sm text-foreground">Old vs new regime</p>
                <RegimeBars />
                <p className="mt-4 text-sm text-muted">
                  Your HRA and home loan interest make the old regime{" "}
                  <span className="text-foreground">{inr(TAX.regimeDifference)} cheaper</span> this year.
                </p>
              </div>
            </div>
            <WaysToPayLess />
          </div>
        </div>
      </Container>
    </section>
  );
}

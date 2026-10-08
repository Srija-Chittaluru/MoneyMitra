"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { MILESTONES, MONTH_ABBR } from "./demo-data";
import { Container, Eyebrow } from "./parts";

/**
 * "Your finances don't stop after tax season." A 12-month timeline with 6
 * highlighted months; clicking one shows its detail below. Plain React state
 * standing in for the design's scroll-position-driven version — this section
 * is the clearest expression of the "useful all year, not just at tax time"
 * idea this whole project has been built around.
 */
export function YearRound() {
  const [selected, setSelected] = useState(MILESTONES[0]);

  return (
    <section id="year" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8 md:mb-16">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Eyebrow>07 · All year</Eyebrow>
            <h2 className="text-h1 md:text-[44px]">Your finances don&apos;t stop after tax season.</h2>
          </div>
          <p data-reveal className="max-w-sm text-body text-muted md:text-lg">
            Mitra keeps reading as new payslips, statements and documents arrive, and brings up what matters
            at the right time of year.
          </p>
        </div>

        <div data-reveal className="overflow-x-auto rounded-lg border border-line bg-card p-5 md:p-8">
          <div className="min-w-[700px]">
            <div className="relative mb-3">
              <div className="absolute left-[4.2%] right-[4.2%] top-1/2 h-px -translate-y-1/2 bg-line" />
              <div className="relative grid grid-cols-12">
                {MONTH_ABBR.map((abbr, i) => {
                  const milestone = MILESTONES.find((m) => m.monthIndex === i);
                  const isSelected = selected.monthIndex === i;
                  return (
                    <button
                      key={abbr}
                      type="button"
                      disabled={!milestone}
                      onClick={() => milestone && setSelected(milestone)}
                      className="flex flex-col items-center gap-2 py-1 disabled:cursor-default"
                    >
                      <span className="font-mono text-[11px] tracking-wide text-muted">{abbr}</span>
                      <span
                        className={cn(
                          "relative z-10 h-3 w-3 rounded-full border-2 transition-colors",
                          milestone
                            ? isSelected
                              ? "border-accent bg-accent"
                              : "border-accent/60 bg-card"
                            : "border-line bg-card",
                        )}
                      />
                      <span
                        className={cn(
                          "min-h-8 max-w-[90px] text-center text-xs leading-tight",
                          milestone ? (isSelected ? "text-foreground" : "text-muted") : "text-muted/50",
                        )}
                      >
                        {milestone?.title ?? ""}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-center">
              <div>
                <p className="font-mono text-xs tracking-wide text-accent-text">{selected.month}</p>
                <p className="mt-2 text-h1 md:text-[40px]">{selected.title}</p>
                <p className="mt-3 max-w-md text-body text-muted">{selected.desc}</p>
              </div>
              <div className="flex flex-col gap-3 rounded-lg border border-line bg-field p-5">
                <p className="text-sm text-foreground">{selected.label}</p>
                <p className="text-3xl font-semibold tracking-tight text-accent-text">{selected.value}</p>
                <p className="text-sm text-foreground">{selected.insight}</p>
                <div className="mt-2 inline-flex h-10 w-fit items-center rounded-md border border-accent/40 px-4 text-sm font-medium text-accent-text">
                  {selected.action}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

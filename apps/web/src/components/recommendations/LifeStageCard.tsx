"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { InvestmentOption, Recommendation } from "@/lib/recommendations/types";

const RISK_BADGE: Record<InvestmentOption["risk"], { variant: "success" | "warning" | "error"; label: string }> = {
  low: { variant: "success", label: "Low risk" },
  medium: { variant: "warning", label: "Medium risk" },
  high: { variant: "error", label: "Higher risk" },
};

/**
 * One piece of life-stage advice. The worked numbers are always visible, since
 * they are what shows how the advice makes money; the steps and the places the
 * money could go sit behind a toggle so the page stays scannable.
 */
export function LifeStageCard({ rec }: { rec: Recommendation }) {
  const [open, setOpen] = useState(false);
  const hasDetails = rec.steps.length > 0 || rec.options.length > 0;

  return (
    <Card className="flex flex-col gap-4">
      <div>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h3 className="text-h2">{rec.title}</h3>
          {rec.illustration?.is_example && <Badge variant="warning">Example figures</Badge>}
        </div>
        <p className="mt-1 text-xs text-muted">{rec.basis}</p>
      </div>

      <p className="text-body text-foreground">{rec.description}</p>

      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">Why: </span>
        {rec.reason}
      </p>

      {rec.illustration && (
        <div className="rounded-lg bg-surface-muted p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{rec.illustration.title}</p>
          <dl className="flex flex-col gap-2">
            {rec.illustration.lines.map((line) => (
              <div
                key={line.label}
                className={cn(
                  "flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4",
                  line.emphasis && "rounded-md bg-surface px-3 py-2",
                )}
              >
                <dt className={cn("text-sm", line.emphasis ? "font-medium text-foreground" : "text-muted")}>
                  {line.label}
                </dt>
                <dd className={cn("font-mono text-sm sm:text-right", line.emphasis ? "font-semibold text-foreground" : "text-foreground")}>
                  {line.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted">{rec.illustration.note}</p>
        </div>
      )}

      {hasDetails && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            className="inline-flex items-center gap-1 text-sm font-medium text-link"
          >
            {open ? "Hide the steps" : "How to do this, and where the money can go"}
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} strokeWidth={2} />
          </button>

          {open && (
            <div className="mt-4 flex flex-col gap-5">
              {rec.steps.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">How to do this</p>
                  <ol className="list-decimal space-y-1.5 pl-5 text-sm text-foreground marker:text-muted">
                    {rec.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>
              )}

              {rec.options.length > 0 && (
                <div>
                  <p className="mb-2 text-sm font-semibold text-foreground">Where the money can go</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {rec.options.map((option) => (
                      <div key={option.name} className="rounded-md border border-border p-3">
                        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-medium text-foreground">{option.name}</span>
                          <Badge variant={RISK_BADGE[option.risk].variant}>{RISK_BADGE[option.risk].label}</Badge>
                        </div>
                        <p className="text-sm text-muted">{option.summary}</p>
                        <p className="mt-1 text-xs text-muted">
                          <span className="font-medium text-foreground">Suits: </span>
                          {option.suits}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {rec.action_label && rec.action_href && (
        <div>
          <Link href={rec.action_href}>
            <Button variant="secondary" size="sm">
              {rec.action_label}
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

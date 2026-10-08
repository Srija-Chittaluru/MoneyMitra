"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckCircle2, ChevronDown, Circle, FileSearch } from "lucide-react";
import type { FormRecommendation } from "@/lib/itr/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";

const FORM_COVERS: Record<FormRecommendation["form"], string> = {
  "ITR-1": "Salary/pension, up to 2 house properties, interest and other income, total up to ₹50 lakh.",
  "ITR-2": "Capital gains, foreign income or assets, income above ₹50 lakh, directors — no business income.",
  "ITR-3": "Business or professional income, including intraday and F&O trading.",
};

/** Which ITR form the documents point to, why, and which documents are still needed. */
export function FormDecisionCard({ recommendation }: { recommendation: FormRecommendation }) {
  const [open, setOpen] = useState(!recommendation.supported);
  const { form, supported, blockers, reasons, other_reasons, checklist } = recommendation;
  const missing = checklist.filter((c) => c.required && !c.uploaded).length;

  return (
    <Card className={cn("p-0", !supported && "ring-2 ring-warning")}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start gap-3 rounded-lg p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring sm:p-6"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          <FileSearch className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="text-h2">Your ITR form: {form}</span>
            {supported ? (
              <Badge variant="success" className="px-2 py-0.5 text-xs">
                MoneyMitra can file this
              </Badge>
            ) : (
              <Badge variant="warning" className="px-2 py-0.5 text-xs">
                File on the Income Tax portal
              </Badge>
            )}
            {missing > 0 && (
              <Badge variant="neutral" className="px-2 py-0.5 text-xs">
                {missing} document{missing === 1 ? "" : "s"} needed
              </Badge>
            )}
          </span>
          <span className="mt-1 block text-sm text-muted">{FORM_COVERS[form]}</span>
        </span>
        <ChevronDown className={cn("mt-1 h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="grid gap-6 px-4 pb-4 sm:px-6 sm:pb-6 lg:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Why {form}</p>
            <ul className="flex flex-col gap-2 text-sm text-foreground">
              {reasons.map((r) => (
                <li key={r.reason} className="flex items-start gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-foreground" />
                  <span>
                    {r.reason} <span className="text-muted">· {r.source}</span>
                  </span>
                </li>
              ))}
            </ul>
            {other_reasons.length > 0 && (
              <>
                <p className="mt-2 text-sm font-semibold text-foreground">Also in your return</p>
                <ul className="flex flex-col gap-1 text-sm text-muted">
                  {other_reasons.map((r) => (
                    <li key={r.reason}>
                      {r.reason} ({r.form})
                    </li>
                  ))}
                </ul>
              </>
            )}
            {supported && form !== "ITR-1" && (
              <p className="mt-2 rounded-md bg-success-bg px-3 py-2 text-sm text-foreground">
                MoneyMitra fills {form} from your documents — your capital gains
                {form === "ITR-3" ? " and trading income" : ""} are under Income Sources, and the download at the end
                is an {form} file.
              </p>
            )}
            {!supported && (
              <div className="mt-2 rounded-md bg-warning-bg px-3 py-2 text-sm text-foreground">
                <p className="font-medium">MoneyMitra can&apos;t prepare this {form} yet:</p>
                <ul className="mt-1 list-disc pl-5">
                  {blockers.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
                <p className="mt-1">File {form} on incometax.gov.in (or the official utility) for now.</p>
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm font-semibold text-foreground">Documents for {form}</p>
            <ul className="flex flex-col divide-y divide-border">
              {checklist.map((c) => (
                <li key={c.category} className="flex items-start gap-3 py-2">
                  {c.uploaded ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className={cn("mt-0.5 h-4 w-4 shrink-0", c.required ? "text-warning" : "text-muted")} />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {c.title}
                      {!c.required && <span className="font-normal text-muted"> · optional</span>}
                    </p>
                    <p className="text-sm text-muted">{c.why}</p>
                  </div>
                </li>
              ))}
            </ul>
            {missing > 0 && (
              <Link
                href="/documents"
                className="inline-flex h-9 w-fit items-center justify-center rounded-md border border-border px-3 text-sm font-semibold text-foreground hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                Upload missing documents
              </Link>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

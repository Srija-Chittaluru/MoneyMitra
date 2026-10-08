"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { CalendarRange } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { PlanningSectionCard } from "@/components/planning/PlanningSectionCard";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { formatRupees } from "@/lib/format";
import { getTaxPlan } from "@/lib/planning/api";
import type { RegimePosition, TaxPlan } from "@/lib/planning/types";

function contextNote(source: TaxPlan["context_source"]): string {
  switch (source) {
    case "itr_filing":
      return "Based on the income and deductions in your ITR filing.";
    case "tax_comparison":
      return "Based on the income and deductions from your latest tax comparison.";
    default:
      return "";
  }
}

function RegimePositionBanner({ position, caveat }: { position: RegimePosition; caveat: string }) {
  const sentence =
    position.recommended_regime === "either"
      ? "Your old and new regime estimates currently come out equal."
      : `You're currently better off under the ${position.recommended_regime === "old" ? "Old" : "New"} Regime by ${formatRupees(position.difference)}.`;

  return (
    <div className="mb-6 flex flex-col gap-2 rounded-lg border border-success-bg bg-success-bg px-4 py-3">
      <div className="flex items-center gap-2">
        <Badge variant="success">
          {position.recommended_regime === "either" ? "Tied" : `${position.recommended_regime === "old" ? "Old" : "New"} Regime ahead`}
        </Badge>
      </div>
      <p className="text-sm text-foreground">{sentence}</p>
      <p className="text-xs text-muted">{caveat}</p>
    </div>
  );
}

export default function TaxPlanningPage() {
  const query = useQuery({ queryKey: ["tax-plan"], queryFn: getTaxPlan });
  const plan = query.data;
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  return (
    <AppShell title="Tax Planning">
      <p className="mb-6 text-sm text-muted">
        Where you stand on tax-saving investments for this financial year — while there&apos;s still time
        to act on it, not just at filing time.
      </p>

      {query.isPending && (
        <div className="flex flex-col gap-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState title="Couldn't load your tax plan" description="Something went wrong. Please try again." />
      )}

      {plan && (
        <>
          <div className="mb-6 flex flex-wrap items-center gap-3">
            <Card className="flex items-center gap-3 bg-card border-line px-4 py-3">
              <CalendarRange className="h-5 w-5 text-muted" strokeWidth={1.5} />
              <span className="text-sm text-foreground">
                FY {plan.fy_label} &middot; {plan.months_remaining}{" "}
                {plan.months_remaining === 1 ? "month" : "months"} left (through{" "}
                {new Date(plan.fy_end).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })})
              </span>
            </Card>
            {plan.stage_label && <Badge variant="accent">{plan.stage_label}</Badge>}
          </div>

          {!plan.has_data && (
            <EmptyState
              icon={CalendarRange}
              title="No income data yet"
              description="Run the Tax Comparison calculator or start your ITR draft first, so there's something to plan against."
              action={
                <Link href="/tax-comparison">
                  <Button variant="secondary" size="sm">
                    Go to Tax Comparison
                  </Button>
                </Link>
              }
            />
          )}

          {plan.has_data && (
            <>
              <p className="mb-4 text-sm text-muted">{contextNote(plan.context_source)}</p>

              {!plan.data_is_current_year && plan.data_fy_label && (
                <div className="mb-6 rounded-lg border border-warning-bg bg-warning-bg px-4 py-3">
                  <p className="text-sm text-foreground">
                    Your saved figures are for FY {plan.data_fy_label}, so your progress for FY {plan.fy_label}{" "}
                    starts from zero. To track this year, enter your investments for FY {plan.fy_label} in{" "}
                    <Link href="/tax-comparison" className="text-link">
                      Tax Comparison
                    </Link>
                    .
                  </p>
                </div>
              )}

              {plan.regime_position && (
                <RegimePositionBanner position={plan.regime_position} caveat={plan.regime_caveat} />
              )}

              {plan.recommendations.length > 0 && (
                <div className="mb-6 grid gap-4 md:grid-cols-2">
                  {plan.recommendations.map((rec) => (
                    <RecommendationCard
                      key={rec.id}
                      title={rec.title}
                      description={rec.description}
                      reason={rec.reason}
                      tag="Tax saving"
                      basis={rec.basis}
                      actionLabel={rec.action_label}
                      actionHref={rec.action_href}
                      className="bg-card border-line"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-col gap-4">
                {plan.sections.map((section) => (
                  <PlanningSectionCard
                    key={section.section}
                    section={section}
                    dataFyLabel={plan.data_fy_label}
                    isSelected={expandedSection === section.section}
                    onSelect={() =>
                      setExpandedSection((current) => (current === section.section ? null : section.section))
                    }
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

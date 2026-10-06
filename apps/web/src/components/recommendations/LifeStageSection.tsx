"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarX } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { getLifeStageRecommendations } from "@/lib/recommendations/api";
import type { LifeStageRecommendations } from "@/lib/recommendations/types";

function contextNote(source: LifeStageRecommendations["context_source"]): string {
  switch (source) {
    case "itr_filing":
      return "Based on your age and the income and deductions in your ITR filing.";
    case "tax_comparison":
      return "Based on your age and the income and deductions from your latest tax comparison.";
    default:
      return "Based on your age. Run a tax comparison or fill in your ITR filing to get advice specific to your income and deductions.";
  }
}

export function LifeStageSection() {
  const query = useQuery({
    queryKey: ["life-stage-recommendations"],
    queryFn: getLifeStageRecommendations,
  });

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h2 className="text-h1">Life-stage recommendations</h2>
        {query.data?.stage_label && <Badge variant="accent">{query.data.stage_label}</Badge>}
      </div>

      {query.isPending && (
        <div className="grid gap-4 md:grid-cols-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-56" />
          ))}
        </div>
      )}

      {query.isError && (
        <ErrorState
          title="Couldn't load your recommendations"
          description="Something went wrong. Please try again."
        />
      )}

      {query.data && query.data.stage === null && (
        <EmptyState
          icon={CalendarX}
          title="Add your date of birth"
          description="Life-stage recommendations are based on your age, and we don't have your date of birth yet."
        />
      )}

      {query.data && query.data.stage !== null && (
        <>
          <p className="mb-4 text-sm text-muted">{contextNote(query.data.context_source)}</p>
          <div className="grid gap-4 md:grid-cols-2">
            {query.data.recommendations.map((rec) => (
              <RecommendationCard
                key={rec.id}
                title={rec.title}
                description={rec.description}
                reason={rec.reason}
                tag={query.data.stage_label ?? ""}
                actionLabel={rec.action_label}
                actionHref={rec.action_href}
              />
            ))}
          </div>
        </>
      )}
    </section>
  );
}

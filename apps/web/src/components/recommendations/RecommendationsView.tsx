"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { getRecommendations } from "@/lib/recommendations/api";
import type { NextStep, Recommendation, RecommendationCategory } from "@/lib/recommendations/types";
import { LevelProgress } from "./LevelProgress";
import { ProfileCard } from "./ProfileCard";

const SECTIONS: { category: RecommendationCategory; title: string; tag: string }[] = [
  { category: "tax_saving", title: "Tax-saving recommendations", tag: "Tax saving" },
  { category: "life_stage", title: "Life-stage recommendations", tag: "Life stage" },
];

function CardGrid({ recs, tag }: { recs: Recommendation[]; tag: string }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {recs.map((rec) => (
        <RecommendationCard
          key={rec.id}
          title={rec.title}
          description={rec.description}
          reason={rec.reason}
          tag={tag}
          basis={rec.basis}
          actionLabel={rec.action_label}
          actionHref={rec.action_href}
        />
      ))}
    </div>
  );
}

export function RecommendationsView() {
  const router = useRouter();
  const [taxYear, setTaxYear] = useState<string | undefined>(undefined);

  const query = useQuery({
    queryKey: ["recommendations", taxYear],
    queryFn: () => getRecommendations(taxYear),
    // Keep showing the previous result while a new tax year loads.
    placeholderData: (previous) => previous,
  });

  function handleNextStep(step: NextStep) {
    if (step.action_href) {
      router.push(step.action_href);
      return;
    }
    const field = document.getElementById("profile-dob");
    field?.scrollIntoView({ behavior: "smooth", block: "center" });
    field?.focus();
  }

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load your recommendations"
        description="Something went wrong. Please try again."
      />
    );
  }

  const data = query.data;

  return (
    <>
      <LevelProgress level={data.level} nextStep={data.next_step} onNextStep={handleNextStep} />
      <ProfileCard
        // Re-initialise the form when the saved profile changes.
        key={JSON.stringify(data.profile)}
        profile={data.profile}
        taxYear={data.tax_year}
        availableTaxYears={data.available_tax_years}
        onTaxYearChange={setTaxYear}
      />

      {data.level === 0 && (
        <p className="text-sm text-muted">
          Add your date of birth above to see recommendations for your stage of life.
        </p>
      )}

      {SECTIONS.map(({ category, title, tag }) => {
        const recs = data.recommendations.filter((rec) => rec.category === category);
        if (recs.length === 0) return null;
        return (
          <section key={category} className="mb-10">
            <div className="mb-4 flex flex-wrap items-center gap-3">
              <h2 className="text-h1">{title}</h2>
              {category === "life_stage" && data.stage_label && <Badge variant="accent">{data.stage_label}</Badge>}
            </div>
            <CardGrid recs={recs} tag={tag} />
          </section>
        );
      })}
    </>
  );
}

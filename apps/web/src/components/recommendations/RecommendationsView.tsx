"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { getRecommendations } from "@/lib/recommendations/api";
import type { NextStep } from "@/lib/recommendations/types";
import { DocumentsPanel } from "./DocumentsPanel";
import { LevelProgress } from "./LevelProgress";
import { LifeStageCard } from "./LifeStageCard";
import { ProfileCard } from "./ProfileCard";

export function RecommendationsView() {
  const router = useRouter();
  const [justSaved, setJustSaved] = useState(false);

  const query = useQuery({ queryKey: ["recommendations"], queryFn: getRecommendations });

  function handleProfileSaved() {
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 3000);
  }

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
      <DocumentsPanel documents={data.documents} />
      <ProfileCard
        // Re-initialise the form when the saved profile changes.
        key={JSON.stringify(data.profile)}
        profile={data.profile}
        level={data.level}
        onSaved={handleProfileSaved}
        justSaved={justSaved}
      />

      {data.level === 0 && (
        <p className="text-sm text-muted">
          Add your date of birth above to see recommendations for your stage of life.
        </p>
      )}

      {data.recommendations.length > 0 && (
        <section className="mb-10">
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h2 className="text-h1">Life-stage recommendations</h2>
            {data.stage_label && <Badge variant="accent">{data.stage_label}</Badge>}
          </div>
          <p className="mb-4 text-sm text-muted">
            Ways to make your existing money work harder at this stage of life, with worked numbers so you can see
            what each one is worth.
          </p>
          <div className="flex flex-col gap-4">
            {data.recommendations.map((rec) => (
              <LifeStageCard key={rec.id} rec={rec} />
            ))}
          </div>
          <p className="mt-4 text-xs text-muted">{data.disclaimer}</p>
        </section>
      )}
    </>
  );
}

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { NextStep, Recommendation } from "@/lib/recommendations/types";
import { EmptyPanel } from "./EmptyPanel";
import { SectionError, SectionSkeleton } from "./SectionStatus";

interface RecommendationsCardProps {
  status: "loading" | "error" | "ready";
  /** Only advice built on the user's own financial data (see deriveDashboardRecommendations). */
  recommendations: Recommendation[];
  nextStep: NextStep | null;
  /** 0 = no profile yet. */
  level: number;
  onRetry: () => void;
  className?: string;
}

const NO_PROFILE_COPY =
  "Complete your profile and add your financial information to receive personalized recommendations.";

/**
 * The dashboard's single most prominent card: up to 3 of the user's own
 * personalised recommendations as numbered steps, most actionable first.
 * Same data/states as before (see deriveDashboardRecommendations) — only the
 * presentation changed, from a plain divided list to a stepped "next move"
 * card. No rupee-impact badge per step: real Recommendation objects don't
 * carry a structured amount field (just free-text description/reason), so
 * unlike the design mockup this doesn't show one rather than inventing it.
 */
export function RecommendationsCard({
  status,
  recommendations,
  nextStep,
  level,
  onRetry,
  className,
}: RecommendationsCardProps) {
  const shown = recommendations.slice(0, 3);

  return (
    <Card className={cn("lg:col-span-2", shown.length > 0 ? "border-success-bg" : "border-line", className)}>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-h2">Your next move</h3>
        <Link href="/recommendations">
          <Button variant="ghost" size="sm">
            View all
          </Button>
        </Link>
      </div>

      {status === "loading" ? (
        <SectionSkeleton />
      ) : status === "error" ? (
        <SectionError message="We couldn't load your recommendations." onRetry={onRetry} />
      ) : shown.length === 0 ? (
        // With a profile but no income yet, say exactly what unlocks the next level.
        <EmptyPanel
          icon={Sparkles}
          description={level > 0 && nextStep ? nextStep.description : NO_PROFILE_COPY}
          action={
            <Link href={level > 0 && nextStep?.action_href ? nextStep.action_href : "/recommendations"}>
              <Button variant="secondary" size="sm">
                {level > 0 && nextStep ? nextStep.action_label : "Complete profile"}
              </Button>
            </Link>
          }
        />
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            {shown.length} {shown.length === 1 ? "action" : "actions"} could help, ranked by relevance.
          </p>
          <div className="flex flex-col gap-3">
            {shown.map((rec, index) => (
              <div key={rec.id} className="flex items-start gap-3 rounded-md border border-line bg-field p-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-line text-sm font-semibold text-foreground">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground">{rec.title}</p>
                  <p className="text-sm text-muted">{rec.description}</p>
                  <p className="mt-1 text-xs text-muted">{rec.basis}</p>
                </div>
              </div>
            ))}
          </div>
          <Link href="/recommendations">
            <Button variant="primary" size="sm" className="mt-4 w-full">
              Review recommendations
            </Button>
          </Link>
          {nextStep && (
            <p className="mt-3 border-t border-line pt-3 text-sm text-muted">
              {nextStep.title}:{" "}
              <Link href={nextStep.action_href ?? "/recommendations"} className="text-link">
                {nextStep.action_label}
              </Link>{" "}
              to unlock more specific advice.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
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
}

const NO_PROFILE_COPY =
  "Complete your profile and add your financial information to receive personalized recommendations.";

export function RecommendationsCard({ status, recommendations, nextStep, level, onRetry }: RecommendationsCardProps) {
  const shown = recommendations.slice(0, 2);

  return (
    <Card className="lg:col-span-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-h2">Recommendations for you</h3>
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
          <div className="flex flex-col divide-y divide-border">
            {shown.map((rec) => (
              <div key={rec.id} className="py-3">
                <p className="font-medium text-foreground">{rec.title}</p>
                <p className="text-sm text-muted">{rec.description}</p>
                <p className="mt-1 text-xs text-muted">{rec.basis}</p>
              </div>
            ))}
          </div>
          {nextStep && (
            <p className="mt-2 border-t border-border pt-3 text-sm text-muted">
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

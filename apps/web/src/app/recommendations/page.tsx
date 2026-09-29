import { AppShell } from "@/components/shell/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { RecommendationCard } from "@/components/ui/RecommendationCard";
import { mockLifeStageRecommendations, mockTaxSavingRecommendations } from "@/lib/mock";

export default function RecommendationsPage() {
  return (
    <AppShell title="Recommendations">
      <DemoBanner label="DEMO / MOCK DATA — illustrative content, not personalized advice" />

      <section className="mb-10">
        <h2 className="text-h1 mb-4">Tax-saving recommendations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {mockTaxSavingRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              title={rec.title}
              description={rec.description}
              reason={rec.reason}
              tag={rec.category}
              actionLabel={rec.actionLabel}
            />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-h1 mb-4">Life-stage recommendations</h2>
        <div className="grid gap-4 md:grid-cols-2">
          {mockLifeStageRecommendations.map((rec) => (
            <RecommendationCard
              key={rec.id}
              title={rec.title}
              description={rec.description}
              reason={rec.reason}
              tag={rec.stage}
              actionLabel={rec.actionLabel}
            />
          ))}
        </div>
      </section>
    </AppShell>
  );
}

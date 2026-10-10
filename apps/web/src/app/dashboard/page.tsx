"use client";

import { AppShell } from "@/components/shell/AppShell";
import { ActivityCard } from "@/components/dashboard/ActivityCard";
import { DocumentsCard } from "@/components/dashboard/DocumentsCard";
import { RecommendationsCard } from "@/components/dashboard/RecommendationsCard";
import { RegimeCard } from "@/components/dashboard/RegimeCard";
import { StatCard } from "@/components/dashboard/StatCard";
import {
  deriveActivity,
  deriveDashboardRecommendations,
  deriveComparison,
  deriveDocumentStatus,
  deriveEstimatedTax,
  deriveFlags,
  deriveIncome,
} from "@/lib/dashboard/state";
import { useDashboardData } from "@/lib/dashboard/useDashboardData";
import { useAuth } from "@/lib/auth/AuthContext";

type SectionStatus = "loading" | "error" | "ready";

function statusOf(query: { isPending: boolean; isError: boolean }): SectionStatus {
  return query.isPending ? "loading" : query.isError ? "error" : "ready";
}

/**
 * Every card is driven by what the user has actually provided: a figure is
 * shown only when it can be calculated from real data, otherwise the card
 * says what is missing and how to add it.
 */
export default function DashboardPage() {
  const { user } = useAuth();
  const { summary, documents, recommendations } = useDashboardData();

  const summaryStatus = statusOf(summary);
  const documentsStatus = statusOf(documents);
  const recommendationsStatus = statusOf(recommendations);

  const income = summary.data ? deriveIncome(summary.data) : null;
  const estimatedTax = summary.data ? deriveEstimatedTax(summary.data) : null;
  const comparison = summary.data ? deriveComparison(summary.data) : null;
  const oldRegimeClosed = summary.data?.regime_unavailable_reason === "old_regime_closed";
  const documentStatus = documents.data ? deriveDocumentStatus(documents.data) : undefined;
  const activity = deriveActivity(summary.data, documents.data);
  const personalised = deriveDashboardRecommendations(recommendations.data?.recommendations ?? []);
  const flags = deriveFlags({
    summary: summary.data,
    documents: documents.data,
    recommendationCount: personalised.length,
  });

  // Activity is built from both the summary and the documents, so it is ready
  // only once both have settled.
  const activityStatus: SectionStatus =
    summaryStatus === "loading" || documentsStatus === "loading"
      ? "loading"
      : summaryStatus === "error" && documentsStatus === "error"
        ? "error"
        : "ready";

  const firstName = user?.name.split(" ")[0] ?? "";
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";
  const eyebrow = now
    .toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
    .toUpperCase();
  const subtitle = flags.hasRecommendations
    ? "Here's what needs your attention."
    : "Here's where things stand today.";

  // Background only — each card component owns its own border color (plain
  // string-join `cn` has no class-conflict resolution, so a border color
  // passed in here could unpredictably clash with a component's own
  // conditional border, e.g. RecommendationsCard's success-tinted one).
  const cardStyle = "bg-card";

  return (
    <AppShell title="Dashboard">
      <div className="mb-6 flex flex-col gap-1">
        <p className="font-mono text-xs tracking-wide text-muted">{eyebrow}</p>
        <h2 className="text-display">
          {greeting}, {firstName}
        </h2>
        <p className="text-muted">{subtitle}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Annual income"
          status={summaryStatus}
          amount={income?.amount ?? null}
          helpText={income ? `From ${income.sourceLabel}` : undefined}
          emptyValue="Not available yet"
          emptyHint="Upload your latest payslip to calculate"
          className={cardStyle}
        />
        <StatCard
          label="Estimated tax"
          status={summaryStatus}
          amount={estimatedTax?.amount ?? null}
          helpText={estimatedTax ? `Under the ${estimatedTax.regime} regime, before any interest or late fee` : undefined}
          emptyValue="Not calculated yet"
          emptyHint={
            flags.hasIncomeData
              ? "We couldn't estimate your tax from your latest details yet"
              : "Add your income details to estimate your tax"
          }
          className={cardStyle}
        />
        <StatCard
          label="Potential savings"
          status={summaryStatus}
          amount={comparison?.savings ?? null}
          helpText={comparison ? (comparison.savings > 0 ? "By choosing the better regime" : "Both regimes cost the same") : undefined}
          emptyValue="Not calculated yet"
          emptyHint={
            oldRegimeClosed
              ? "Only the new regime applies to your return"
              : flags.hasIncomeData
                ? "Both regimes can't be compared for your latest details yet"
                : "Complete your tax profile to compare your options"
          }
          className={cardStyle}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RecommendationsCard
          status={recommendationsStatus}
          recommendations={personalised}
          nextStep={recommendations.data?.next_step ?? null}
          level={recommendations.data?.level ?? 0}
          onRetry={() => void recommendations.refetch()}
          className={cardStyle}
        />
        <ActivityCard
          status={activityStatus}
          items={activity}
          onRetry={() => {
            void summary.refetch();
            void documents.refetch();
          }}
          className={cardStyle}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RegimeCard
          status={summaryStatus}
          tax={comparison}
          hasIncome={flags.hasIncomeData}
          oldRegimeClosed={oldRegimeClosed}
          onRetry={() => void summary.refetch()}
          className={cardStyle}
        />
        <DocumentsCard
          status={documentsStatus}
          documents={documentStatus}
          onRetry={() => void documents.refetch()}
          className={cardStyle}
        />
      </div>
    </AppShell>
  );
}

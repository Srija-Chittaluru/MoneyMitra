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

  return (
    <AppShell title="Dashboard">
      <h2 className="text-h1 mb-6">Welcome back, {user?.name.split(" ")[0]}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Annual income"
          status={summaryStatus}
          amount={income?.amount ?? null}
          helpText={income ? `From ${income.sourceLabel}` : undefined}
          emptyValue="Not available yet"
          emptyHint="Upload your latest payslip to calculate"
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
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RegimeCard
          status={summaryStatus}
          tax={comparison}
          hasIncome={flags.hasIncomeData}
          oldRegimeClosed={oldRegimeClosed}
          onRetry={() => void summary.refetch()}
        />
        <DocumentsCard
          status={documentsStatus}
          documents={documentStatus}
          onRetry={() => void documents.refetch()}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <RecommendationsCard
          status={recommendationsStatus}
          recommendations={personalised}
          nextStep={recommendations.data?.next_step ?? null}
          level={recommendations.data?.level ?? 0}
          onRetry={() => void recommendations.refetch()}
        />
        <ActivityCard
          status={activityStatus}
          items={activity}
          onRetry={() => {
            void summary.refetch();
            void documents.refetch();
          }}
        />
      </div>
    </AppShell>
  );
}

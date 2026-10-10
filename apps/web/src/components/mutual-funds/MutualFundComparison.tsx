"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthContext";
import { getMutualFunds } from "@/lib/funds/api";
import type { Cap, CapCategory, CapRecommendation, MutualFundsResponse } from "@/lib/funds/types";
import { CAP_COLORS, GrowthChart } from "./CapGrowthChart";
import { FundListTable } from "./FundListTable";

const PERIODS = ["1Y", "3Y", "5Y", "Since launch"] as const;
type Period = (typeof PERIODS)[number];

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

/** First month of the chosen period, YYYY-MM, counted back from the latest NAV. */
function fromMonth(period: Period, data: MutualFundsResponse): string {
  if (period === "Since launch") {
    // The latest-launched fund sets the start, so all three lines begin together.
    return data.categories.map((c) => c.history[0].date.slice(0, 7)).sort().at(-1)!;
  }
  const years = { "1Y": 1, "3Y": 3, "5Y": 5 }[period];
  const latest = new Date(data.as_of);
  return `${latest.getFullYear() - years}-${String(latest.getMonth() + 1).padStart(2, "0")}`;
}

function MixBar({ mix }: { mix: Record<Cap, number> }) {
  const parts = (["large", "mid", "small"] as const).filter((cap) => mix[cap] > 0);
  const labels: Record<Cap, string> = { large: "Large", mid: "Mid", small: "Small" };
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
        {parts.map((cap) => (
          <div key={cap} style={{ width: `${mix[cap]}%`, background: CAP_COLORS[cap] }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {parts.map((cap) => (
          <span key={cap} className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full" style={{ background: CAP_COLORS[cap] }} />
            {labels[cap]} cap <span className="font-semibold text-foreground">{mix[cap]}%</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function RecommendationCard({ recommendation, missing }: { recommendation: CapRecommendation | null; missing: string[] }) {
  if (!recommendation) {
    return (
      <Card className="flex flex-col items-start gap-3 border-line bg-card p-4 sm:flex-row sm:items-center sm:p-6">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-muted">
          <UserRound className="h-5 w-5 text-muted" strokeWidth={1.5} />
        </span>
        <div className="flex-1">
          <p className="font-semibold text-foreground">Which cap suits you depends on your age and income</p>
          <p className="text-sm text-muted">
            Add your date of birth and income under Personalized Recommendations, and we&apos;ll tell you which one fits.
            The history below is for everyone.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Sparkles className="h-5 w-5 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
        <h3 className="text-h2">{recommendation.title}</h3>
        <Badge variant="neutral" className="text-xs">
          {recommendation.basis}
        </Badge>
      </div>
      <ul className="mt-3 flex flex-col gap-1.5 text-sm text-foreground">
        {recommendation.reasons.map((reason) => (
          <li key={reason} className="flex gap-2">
            <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" aria-hidden="true" />
            {reason}
          </li>
        ))}
      </ul>

      <div className="mt-5 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div>
          <p className="mb-2 text-sm font-semibold text-foreground">A mix that fits you</p>
          <MixBar mix={recommendation.mix} />
        </div>
        {recommendation.monthly_sip && (
          <div className="rounded-md bg-surface-muted px-4 py-3 sm:text-right">
            <p className="text-xs text-muted">Start a monthly SIP of</p>
            <p className="text-amount-sm text-foreground">{formatRupees(recommendation.monthly_sip)}</p>
            <p className="text-xs text-muted">about 10% of your monthly income</p>
          </div>
        )}
      </div>
      {missing.includes("income") && (
        <p className="mt-3 text-xs text-muted">Add your income to get a suggested SIP amount and a sharper match.</p>
      )}
    </Card>
  );
}

function CapTile({ category, recommended }: { category: CapCategory; recommended: boolean }) {
  return (
    <Card className={cn("flex flex-col gap-3 border-line bg-card p-4 sm:p-5", recommended && "ring-2 ring-[var(--series-1)]")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold text-foreground">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: CAP_COLORS[category.cap] }} aria-hidden="true" />
            {category.label}
          </p>
          <p className="text-xs text-muted">{category.benchmark}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {recommended && <Badge variant="accent" className="text-xs">Suits you</Badge>}
          <Badge variant={category.risk === "Moderate" ? "neutral" : "warning"} className="text-xs">
            {category.risk} risk
          </Badge>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-3 text-center">
        {(
          [
            ["1 yr", category.returns.one_year],
            ["3 yr", category.returns.three_year],
            ["5 yr", category.returns.five_year],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-mono text-sm font-semibold text-foreground">{formatReturn(value)}</dd>
          </div>
        ))}
      </dl>
      <p className="-mt-1 text-center text-xs text-muted">Returns a year, compounded</p>

      <div className="flex justify-between text-sm">
        <span className="text-muted">Worst fall</span>
        <span className="font-mono text-foreground">{category.worst_fall.toFixed(1)}%</span>
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Stay invested</span>
        <span className="text-foreground">{category.min_years}+ years</span>
      </div>
      <p className="text-sm text-muted">
        {category.what_it_is} {category.suits}
      </p>
      <p className="mt-auto border-t border-line pt-3 text-xs text-muted">
        Tracked by {category.scheme_name} · NAV ₹{category.latest_nav.toFixed(2)} on{" "}
        {dateFormat.format(new Date(category.latest_nav_date))}
      </p>
    </Card>
  );
}

/**
 * Mutual funds by market cap: which cap suits the user (rules on age and
 * income), then how large, mid and small caps have actually performed, from
 * AMFI NAVs. Shown under Recommendations → Mutual Funds.
 */
export function MutualFundComparison() {
  const { status } = useAuth();
  const query = useQuery({ queryKey: ["mutual-funds"], queryFn: getMutualFunds, enabled: status === "authenticated" });
  const [period, setPeriod] = useState<Period>("5Y");

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load mutual fund data"
        description={query.error.message}
        action={
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        }
      />
    );
  }

  const data = query.data;
  const recommended = data.recommendation?.cap;

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">
        Which type of equity mutual fund suits you, and how large, mid and small caps have really performed.
      </p>

      <RecommendationCard recommendation={data.recommendation} missing={data.missing} />

      <section>
        <h3 className="mb-3 text-h2">How each cap has performed</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {data.categories.map((category) => (
            <CapTile key={category.cap} category={category} recommended={category.cap === recommended} />
          ))}
        </div>
      </section>

      <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-h2">What ₹10,000 would have become</h3>
            <p className="text-sm text-muted">Invested once at the start of the period, by market cap</p>
          </div>
          <SegmentedControl options={PERIODS} value={period} onChange={setPeriod} className="max-w-full overflow-x-auto" />
        </div>
        <GrowthChart
          series={data.categories.map((c) => ({ id: c.cap, label: c.label, color: CAP_COLORS[c.cap], history: c.history }))}
          fromMonth={fromMonth(period, data)}
        />
      </Card>

      <FundListTable
        lists={data.fund_lists}
        initial={recommended ?? "large"}
        asOf={data.fund_lists_as_of}
        title="Funds in each category"
        subtitle="Direct plans, growth option"
      />

      <p className="text-xs text-muted">
        Source: {data.source}, NAVs up to {dateFormat.format(new Date(data.as_of))}
        {data.live ? ", updated daily." : " (saved copy; AMFI couldn't be reached just now)."} Each cap is shown through
        an index fund that tracks its benchmark, so returns reflect the category, not one fund manager. {data.disclaimer}
      </p>
    </div>
  );
}

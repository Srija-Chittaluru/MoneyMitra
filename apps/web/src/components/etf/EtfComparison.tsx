"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Lightbulb } from "lucide-react";
import { GrowthChart } from "@/components/mutual-funds/CapGrowthChart";
import { FundListTable } from "@/components/mutual-funds/FundListTable";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { getEtfs } from "@/lib/funds/api";
import type { EtfBenchmark, EtfsResponse } from "@/lib/funds/types";

const COLORS: Record<EtfBenchmark["id"], string> = {
  nifty50: "var(--series-1)",
  gold: "var(--series-2)",
  silver: "var(--series-3)",
};

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

function formatReturn(value: number | null): string {
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}%`;
}

type Period = "1Y" | "3Y" | "all";

/** First month shown. "all" starts when the youngest benchmark (silver) began, so every line starts together. */
function fromMonth(period: Period, data: EtfsResponse): string {
  if (period === "all") return data.benchmarks.map((b) => b.history[0].date.slice(0, 7)).sort().at(-1)!;
  const latest = new Date(data.as_of);
  return `${latest.getFullYear() - (period === "1Y" ? 1 : 3)}-${String(latest.getMonth() + 1).padStart(2, "0")}`;
}

function MixCard({ data }: { data: EtfsResponse }) {
  const mix = data.mix;
  return (
    <Card className="border-line bg-card p-4 sm:p-6">
      {mix ? (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-h2">A simple ETF mix for you</h3>
            {data.mix_basis && (
              <Badge variant="neutral" className="text-xs">
                {data.mix_basis}
              </Badge>
            )}
          </div>
          <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden="true">
            {data.benchmarks.map((b) => (
              <div key={b.id} style={{ width: `${mix[b.id]}%`, background: COLORS[b.id] }} />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
            {data.benchmarks.map((b) => (
              <span key={b.id} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full" style={{ background: COLORS[b.id] }} />
                {b.label} ETF <span className="font-semibold text-foreground">{mix[b.id]}%</span>
              </span>
            ))}
          </div>
        </>
      ) : (
        <>
          <h3 className="text-h2">A simple ETF mix</h3>
          <p className="mt-1 text-sm text-muted">
            Add your date of birth under Personalized Recommendations to see how much to keep in shares vs gold and
            silver.
          </p>
        </>
      )}
      <ul className="mt-4 flex flex-col gap-2 border-t border-line pt-4 text-sm text-foreground">
        {data.tips.map((tip) => (
          <li key={tip} className="flex gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" strokeWidth={1.75} aria-hidden="true" />
            {tip}
          </li>
        ))}
      </ul>
    </Card>
  );
}

function BenchmarkTile({ benchmark }: { benchmark: EtfBenchmark }) {
  return (
    <Card className="flex flex-col gap-3 border-line bg-card p-4 sm:p-5">
      <div>
        <p className="flex items-center gap-2 font-semibold text-foreground">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: COLORS[benchmark.id] }} aria-hidden="true" />
          {benchmark.label}
        </p>
        <p className="text-xs text-muted">{benchmark.scheme_name}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 rounded-md bg-surface-muted p-3 text-center">
        {(
          [
            ["1 yr", benchmark.returns.one_year],
            ["3 yr", benchmark.returns.three_year],
            ["5 yr", benchmark.returns.five_year],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs text-muted">{label}</dt>
            <dd className="font-mono text-sm font-semibold text-foreground">{formatReturn(value)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Worst fall</span>
        <span className="font-mono text-foreground">{benchmark.worst_fall.toFixed(1)}%</span>
      </div>
      <p className="mt-auto border-t border-line pt-3 text-xs text-muted">
        NAV ₹{benchmark.latest_nav.toFixed(2)} on {dateFormat.format(new Date(benchmark.latest_nav_date))}
      </p>
    </Card>
  );
}

/**
 * ETFs: a simple shares / gold / silver mix for the user's age, how each has
 * performed (AMFI NAVs, adjusted for unit splits), and every ETF in each group.
 * Shown under Recommendations → ETFs.
 */
export function EtfComparison() {
  const { status } = useAuth();
  const query = useQuery({ queryKey: ["etfs"], queryFn: getEtfs, enabled: status === "authenticated" });
  const [period, setPeriod] = useState<Period>("all");

  if (query.isPending) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-48" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
          <Skeleton className="h-56" />
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorState
        title="Couldn't load ETF data"
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
  const allStart = fromMonth("all", data);
  const periodLabels: Record<Period, string> = { "1Y": "1Y", "3Y": "3Y", all: `Since ${monthFormat.format(new Date(`${allStart}-01`))}` };
  const labels = (Object.keys(periodLabels) as Period[]).map((p) => periodLabels[p]);

  return (
    <div className="flex flex-col gap-6">
      <p className="text-body text-muted">
        ETFs are low-cost funds you buy and sell on the stock exchange like shares. Compare shares, gold and silver, and
        every ETF in each group.
      </p>

      <MixCard data={data} />

      <section>
        <h3 className="mb-3 text-h2">Shares vs gold vs silver</h3>
        <div className="grid gap-4 md:grid-cols-3">
          {data.benchmarks.map((b) => (
            <BenchmarkTile key={b.id} benchmark={b} />
          ))}
        </div>
      </section>

      <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-h2">What ₹10,000 would have become</h3>
            <p className="text-sm text-muted">Invested once at the start of the period</p>
          </div>
          <SegmentedControl
            options={labels}
            value={periodLabels[period]}
            onChange={(label) => setPeriod((Object.keys(periodLabels) as Period[]).find((p) => periodLabels[p] === label)!)}
            className="max-w-full overflow-x-auto"
          />
        </div>
        <GrowthChart
          series={data.benchmarks.map((b) => ({ id: b.id, label: b.label, color: COLORS[b.id], history: b.history }))}
          fromMonth={fromMonth(period, data)}
        />
      </Card>

      <FundListTable
        lists={data.lists}
        initial="nifty50"
        asOf={data.as_of}
        title="ETFs by what they track"
        subtitle="Listed on NSE and BSE"
      />

      <p className="text-xs text-muted">
        Source: {data.source}, NAVs up to {dateFormat.format(new Date(data.as_of))}, adjusted for unit splits.{" "}
        {data.disclaimer}
      </p>
    </div>
  );
}

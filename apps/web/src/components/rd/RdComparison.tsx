"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Repeat } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Input } from "@/components/ui/Input";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { useAuth } from "@/lib/auth/AuthContext";
import { formatRupees } from "@/lib/format";
import { getRdRates } from "@/lib/rd-rates/api";
import { rdMaturity } from "@/lib/rd-rates/types";
import type { RdRatesResponse, RdTenure } from "@/lib/rd-rates/types";
import { RdRateChart } from "./RdRateChart";

const DEFAULT_MONTHLY = 5000;
const MAX_MONTHLY = 10_00_000;
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function RdCalculator({ data }: { data: RdRatesResponse }) {
  const [monthlyText, setMonthlyText] = useState(String(data.suggested_monthly ?? DEFAULT_MONTHLY));
  const [tenure, setTenure] = useState<RdTenure>("3y");
  const [senior, setSenior] = useState(data.is_senior);

  const monthly = Math.min(MAX_MONTHLY, Math.max(0, Math.floor(Number(monthlyText) || 0)));
  const tenureInfo = data.tenures.find((t) => t.id === tenure)!;
  const deposited = monthly * tenureInfo.months;
  const category = senior ? "senior_citizen" : "general";

  const rows = data.rates
    .filter((r) => r.tenure === tenure && r.customer_category === category)
    .map((rate) => {
      const total = rdMaturity(monthly, rate.annual_rate, tenureInfo.months);
      return { rate, total, interest: total - deposited, belowMinimum: rate.min_monthly !== null && monthly > 0 && monthly < rate.min_monthly };
    })
    .sort((a, b) => b.rate.annual_rate - a.rate.annual_rate || a.rate.provider_name.localeCompare(b.rate.provider_name));
  const best = rows[0];

  return (
    <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
      <Card className="flex flex-col gap-5 border-line bg-card p-4 sm:p-6">
        <Input
          id="rd-monthly"
          type="number"
          inputMode="numeric"
          min={0}
          max={MAX_MONTHLY}
          step={100}
          label="Monthly deposit (₹)"
          hint={data.suggestion_basis ?? "Add your income under Personalized Recommendations for a suggested amount."}
          value={monthlyText}
          onChange={(e) => setMonthlyText(e.target.value)}
        />
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">For how long</span>
          <SegmentedControl
            options={data.tenures.map((t) => t.label)}
            value={tenureInfo.label}
            onChange={(label) => setTenure(data.tenures.find((t) => t.label === label)!.id)}
            className="max-w-full overflow-x-auto"
          />
        </div>
        <label className="flex items-center justify-between gap-3 text-sm text-foreground">
          <span>
            Senior citizen rates
            <span className="block text-xs text-muted">{data.is_senior ? "Applied: you're 60 or older" : "For depositors aged 60+"}</span>
          </span>
          <Switch checked={senior} onCheckedChange={setSenior} label="Senior citizen rates" />
        </label>
      </Card>

      <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
        {monthly === 0 ? (
          <EmptyState icon={Repeat} title="Enter a monthly amount" description="Type how much you'd deposit each month to see what you get back." />
        ) : rows.length === 0 ? (
          <EmptyState icon={Repeat} title="No rates for this tenure" description="Choose another length of time." />
        ) : (
          <>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-xs text-muted">You deposit</p>
                <p className="text-amount-sm text-foreground">{formatRupees(deposited)}</p>
                <p className="text-xs text-muted">
                  {formatRupees(monthly)} × {tenureInfo.months} months
                </p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-xs text-muted">You get back (best rate)</p>
                <p className="text-amount-sm text-foreground">{formatRupees(best.total)}</p>
                <p className="text-xs text-muted">{best.rate.provider_name}</p>
              </div>
              <div className="rounded-md bg-surface-muted p-3">
                <p className="text-xs text-muted">Interest you earn</p>
                <p className="text-amount-sm text-foreground">{formatRupees(best.interest)}</p>
                <p className="text-xs text-muted">at {best.rate.annual_rate.toFixed(2)}% a year</p>
              </div>
            </div>

            <h3 className="mb-1 text-h2">Interest rate, % a year</h3>
            <p className="mb-4 text-sm text-muted">
              {tenureInfo.label} · {senior ? "senior citizens" : "general customers"} · {rows.length} providers, highest
              first · {best.rate.provider_name} pays the most
            </p>
            <RdRateChart rows={rows} months={tenureInfo.months} />

            <details className="mt-5 rounded-md border border-line px-3 py-2 text-sm">
              <summary className="cursor-pointer font-medium text-foreground">Rates, maturity and sources</summary>
              <ul className="mt-2 flex flex-col divide-y divide-line">
                {rows.map(({ rate, total, interest, belowMinimum }) => (
                  <li key={rate.provider_id} className="flex flex-col gap-1 py-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-foreground">
                        {rate.provider_name}
                        {rate === best.rate && rows.length > 1 && (
                          <Badge variant="accent" className="text-xs">
                            Highest return
                          </Badge>
                        )}
                      </span>
                      <span className="text-foreground">
                        {formatRupees(total)} <span className="text-muted">(+{formatRupees(interest)})</span>
                      </span>
                    </div>
                    <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                      {rate.annual_rate.toFixed(2)}% · effective {dateFormat.format(new Date(rate.effective_date))} ·
                      <a href={rate.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-link hover:underline">
                        {rate.source}
                        <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                      {belowMinimum && <span className="text-warning">· Minimum deposit is {formatRupees(rate.min_monthly!)} a month</span>}
                    </p>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
      </Card>
    </div>
  );
}

/**
 * Recurring deposit comparison: how much a monthly deposit grows to with each
 * provider, at their published rates. Shown under Recommendations → Recurring Deposits.
 */
export function RdComparison() {
  const { status } = useAuth();
  const query = useQuery({ queryKey: ["rd-rates"], queryFn: getRdRates, enabled: status === "authenticated" });

  return (
    <div>
      <p className="mb-4 text-body text-muted">
        Save a fixed amount every month and see what it grows to with each bank. An RD earns the same rate as an FD of
        the same length.
      </p>

      {query.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load RD rates"
          description={query.error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <>
          <RdCalculator key={`${query.data.suggested_monthly}-${query.data.is_senior}`} data={query.data} />
          <p className="mt-6 text-xs text-muted">
            Rates checked on {dateFormat.format(new Date(query.data.checked_on))}. {query.data.disclaimer} This is general
            information, not investment advice.
          </p>
        </>
      )}
    </div>
  );
}

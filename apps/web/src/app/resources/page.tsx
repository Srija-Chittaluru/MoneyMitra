"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileCheck2, HeartPulse, Home, PiggyBank, Receipt, TrendingUp } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { getResources } from "@/lib/resources/api";
import type { AlertCategory } from "@/lib/resources/types";
import { getSlabTable, getSupportedTaxYears } from "@/lib/tax/api";
import type { SlabRate } from "@/lib/tax/types";

const AGE_CATEGORIES = [
  { value: "general", label: "Below 60" },
  { value: "senior", label: "60 to 79" },
  { value: "super_senior", label: "80 and above" },
];

const CATEGORY_META: Record<AlertCategory, { icon: typeof FileCheck2; label: string; className: string }> = {
  itr_filing: { icon: FileCheck2, label: "ITR filing", className: "bg-accent text-accent-foreground" },
  advance_tax: { icon: Receipt, label: "Advance tax", className: "bg-warning-bg text-warning" },
  investment_deadline: { icon: PiggyBank, label: "Investment deadline", className: "bg-success-bg text-success" },
};

const SECTION_META: Record<string, { icon: typeof PiggyBank }> = {
  "80C": { icon: PiggyBank },
  "80D": { icon: HeartPulse },
  "24B": { icon: Home },
  "80CCD(1B)": { icon: TrendingUp },
};

function formatAlertDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

function daysUntil(value: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(value);
  return Math.round((target.getTime() - today.getTime()) / msPerDay);
}

function UrgencyBadge({ days }: { days: number }) {
  const label = days === 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days left`;
  const variant = days <= 15 ? "error" : days <= 45 ? "warning" : "neutral";
  return <Badge variant={variant}>{label}</Badge>;
}

function rateTone(rate: number): string {
  if (rate === 0) return "bg-success-bg text-success";
  if (rate < 0.15) return "bg-accent text-accent-foreground";
  if (rate < 0.25) return "bg-warning-bg text-warning";
  return "bg-error-bg text-error";
}

function SlabRateTable({ title, rows }: { title: string; rows: SlabRate[] }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      <div className="flex overflow-hidden rounded-md">
        {rows.map((row) => (
          <div
            key={row.lower}
            className={cn("flex h-9 flex-1 items-center justify-center text-xs font-semibold", rateTone(row.rate))}
          >
            {(row.rate * 100).toFixed(0)}%
          </div>
        ))}
      </div>
      <div className="overflow-x-auto rounded-md border border-line">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line bg-field text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-3 py-2">Income range</th>
              <th className="px-3 py-2 text-right">Rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.lower} className="border-b border-line last:border-0">
                <td className="px-3 py-2 text-foreground">
                  {row.upper === null
                    ? `Above ${formatRupees(row.lower)}`
                    : `${formatRupees(row.lower)} – ${formatRupees(row.upper)}`}
                </td>
                <td className="px-3 py-2 text-right">
                  <span className={cn("rounded-full px-2 py-0.5 text-xs font-semibold", rateTone(row.rate))}>
                    {(row.rate * 100).toFixed(0)}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function ResourcesPage() {
  const resourcesQuery = useQuery({ queryKey: ["resources"], queryFn: getResources });
  const yearsQuery = useQuery({ queryKey: ["tax-years"], queryFn: getSupportedTaxYears });

  const [taxYear, setTaxYear] = useState("");
  const [ageCategory, setAgeCategory] = useState("general");
  const selectedTaxYear = taxYear || yearsQuery.data?.[0] || "";

  const slabQuery = useQuery({
    queryKey: ["slab-table", selectedTaxYear, ageCategory],
    queryFn: () => getSlabTable(selectedTaxYear, ageCategory),
    enabled: Boolean(selectedTaxYear),
  });

  return (
    <AppShell title="Resources & Alerts">
      <p className="mb-6 text-sm text-muted">
        Key tax deadlines, slab rates, and deduction limits in one place — manually verified and kept
        up to date, not a live feed.
      </p>

      <div className="mb-8 flex flex-col gap-3">
        <h3 className="text-h2">Government alerts</h3>
        {resourcesQuery.isPending && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
        )}
        {resourcesQuery.isError && (
          <ErrorState title="Couldn't load alerts" description="Something went wrong. Please try again." />
        )}
        {resourcesQuery.data && resourcesQuery.data.alerts.length === 0 && (
          <p className="text-sm text-muted">No upcoming alerts right now.</p>
        )}
        {resourcesQuery.data && resourcesQuery.data.alerts.length > 0 && (
          <div className="relative flex flex-col gap-5 pl-2">
            <div className="absolute bottom-4 left-[19px] top-4 w-px bg-line" aria-hidden />
            {resourcesQuery.data.alerts.map((alert, index) => {
              const meta = CATEGORY_META[alert.category];
              const Icon = meta.icon;
              const days = daysUntil(alert.date);
              return (
                <div key={alert.title} className="relative flex gap-4">
                  <div
                    className={cn(
                      "z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ring-background",
                      meta.className,
                    )}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <Card className={cn("flex flex-1 flex-col gap-2 bg-card border-line", index === 0 && "ring-2 ring-line")}>
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-medium uppercase tracking-wide text-muted">
                          {meta.label} · {formatAlertDate(alert.date)}
                        </span>
                        <h4 className="text-body font-semibold text-foreground">{alert.title}</h4>
                      </div>
                      <UrgencyBadge days={days} />
                    </div>
                    <p className="text-sm text-muted">{alert.description}</p>
                    {alert.source && <p className="text-xs text-muted">Source: {alert.source}</p>}
                  </Card>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mb-8 flex flex-col gap-3">
        <h3 className="text-h2">Tax slab rates</h3>
        <Card className="flex flex-col gap-4 bg-card border-line">
          <div className="grid gap-4 sm:grid-cols-2">
            <Select
              id="slab-tax-year"
              label="Tax year"
              value={selectedTaxYear}
              onChange={(e) => setTaxYear(e.target.value)}
              disabled={yearsQuery.isLoading}
              className="bg-field border-line"
            >
              {(yearsQuery.data ?? []).map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </Select>
            <Select
              id="slab-age-category"
              label="Age"
              value={ageCategory}
              onChange={(e) => setAgeCategory(e.target.value)}
              className="bg-field border-line"
            >
              {AGE_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </Select>
          </div>

          {slabQuery.isPending && (
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48" />
              <Skeleton className="h-48" />
            </div>
          )}
          {slabQuery.isError && (
            <ErrorState title="Couldn't load slab rates" description="Something went wrong. Please try again." />
          )}
          {slabQuery.data && (
            <div className="grid gap-4 md:grid-cols-2">
              <SlabRateTable title="Old Regime" rows={slabQuery.data.old_regime} />
              <SlabRateTable title="New Regime" rows={slabQuery.data.new_regime} />
            </div>
          )}
        </Card>
      </div>

      <div className="flex flex-col gap-3">
        <h3 className="text-h2">Deduction limits</h3>
        {resourcesQuery.data && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {resourcesQuery.data.deduction_limits.map((limit) => {
              const Icon = SECTION_META[limit.section]?.icon ?? PiggyBank;
              return (
                <Card key={limit.section} className="flex flex-col gap-3 bg-card border-line">
                  <div className="flex items-center gap-2">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-field text-foreground">
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                    <span className="text-sm font-medium text-foreground">{limit.label}</span>
                  </div>
                  <span className="text-amount-lg text-foreground">{formatRupees(limit.limit_general)}</span>
                  {limit.limit_senior !== null && (
                    <span className="text-xs text-muted">
                      Senior citizens: <span className="font-medium text-foreground">{formatRupees(limit.limit_senior)}</span>
                    </span>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>
  );
}

"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink, Landmark } from "lucide-react";
import { FdBankSelector } from "./FdBankSelector";
import { FdRateChart } from "./FdRateChart";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useAuth } from "@/lib/auth/AuthContext";
import { getFdRates } from "@/lib/fd-rates/api";
import { FD_TENURES } from "@/lib/fd-rates/types";
import type { FdTenure } from "@/lib/fd-rates/types";

const TENURE_LABELS = FD_TENURES.map((t) => t.label);
const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });
// Standing bars stay readable up to about this many at once; past that, pick fewer banks to compare.
const DEFAULT_VISIBLE = 5;

/**
 * The FD rate comparison: tenure filter, bank list and rate chart. Shown under
 * Recommendations → Fixed Deposits; it runs on clearly labelled sample data
 * until the FD-rates API exists (see lib/fd-rates/api.ts).
 */
export function FdComparison() {
  const { status } = useAuth();
  // Wait for the session, so the request has its token once this calls the real API.
  const query = useQuery({ queryKey: ["fd-rates"], queryFn: getFdRates, enabled: status === "authenticated" });
  const [tenure, setTenure] = useState<FdTenure>("up_to_2y");
  // null until the user changes the selection: every bank starts selected.
  const [chosen, setChosen] = useState<Set<string> | null>(null);

  const data = query.data;
  // General-customer rates for the chosen tenure; one row per bank.
  const tenureRates = (data?.rates ?? []).filter((r) => r.tenure === tenure && r.customer_category === "general");
  const tenureRatesByRate = [...tenureRates].sort(
    (a, b) => b.annual_rate - a.annual_rate || a.bank_name.localeCompare(b.bank_name),
  );
  // Until the user picks their own banks, show only the top few — standing bars stop being
  // readable once there are more than a handful on screen at once.
  const defaultSelected = new Set(tenureRatesByRate.slice(0, DEFAULT_VISIBLE).map((r) => r.bank_id));
  const selected = chosen ?? defaultSelected;
  const shown = tenureRates.filter((r) => selected.has(r.bank_id));
  const sorted = [...shown].sort((a, b) => b.annual_rate - a.annual_rate || a.bank_name.localeCompare(b.bank_name));
  const best = sorted[0];
  const isDefaultView = chosen === null && tenureRates.length > DEFAULT_VISIBLE;

  function toggle(bankId: string) {
    const next = new Set(selected);
    if (next.has(bankId)) next.delete(bankId);
    else next.add(bankId);
    setChosen(next);
  }

  return (
    <div>
      <p className="mb-4 text-body text-muted">
        Compare fixed deposit interest rates across banks for the length of time you want to invest.
      </p>

      {data?.is_sample && <DemoBanner label="Sample data — not actual or current bank rates" />}

      <div className="mb-8">
        <SegmentedControl
          options={TENURE_LABELS}
          value={FD_TENURES.find((t) => t.id === tenure)!.label}
          onChange={(label) => setTenure(FD_TENURES.find((t) => t.label === label)!.id)}
          className="max-w-full overflow-x-auto"
        />
      </div>

      {query.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[23rem_minmax(0,1fr)]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load FD rates"
          description={query.error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-[23rem_minmax(0,1fr)] lg:items-start">
          <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
            <FdBankSelector
              rates={tenureRatesByRate}
              selected={selected}
              onToggle={toggle}
              onSelectAll={() => setChosen(new Set(tenureRates.map((r) => r.bank_id)))}
              onClear={() => setChosen(new Set())}
            />
          </Card>

          <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
            {shown.length === 0 ? (
              <EmptyState
                icon={Landmark}
                title="No banks selected"
                description="Choose one or more banks from the list to compare their rates."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setChosen(new Set(tenureRates.map((r) => r.bank_id)))}>
                    Select all banks
                  </Button>
                }
              />
            ) : (
              <>
                {best && shown.length > 1 && (
                  <div className="mb-5 flex items-center gap-3 rounded-lg border border-accent/40 bg-accent/10 p-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent text-accent-foreground">
                      <Landmark className="h-4.5 w-4.5" strokeWidth={1.75} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-muted">Best rate available</p>
                      <p className="truncate text-sm font-semibold text-foreground">{best.bank_name}</p>
                    </div>
                    <p className="shrink-0 text-amount-sm text-foreground">{best.annual_rate.toFixed(2)}%</p>
                  </div>
                )}

                <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <h2 className="text-h2">Interest rate, % a year</h2>
                    <p className="text-sm text-muted">
                      {FD_TENURES.find((t) => t.id === tenure)!.label} · general customers · highest first
                    </p>
                  </div>
                  {isDefaultView && (
                    <button
                      type="button"
                      onClick={() => setChosen(new Set(tenureRates.map((r) => r.bank_id)))}
                      className="text-xs font-medium text-link hover:underline"
                    >
                      Showing top {DEFAULT_VISIBLE} of {tenureRates.length} · see all
                    </button>
                  )}
                </div>

                <FdRateChart rates={shown} isSample={Boolean(data?.is_sample)} />

                {!data?.is_sample && (
                  <details className="mt-5 rounded-md border border-line px-3 py-2 text-sm">
                    <summary className="cursor-pointer font-medium text-foreground">Rates and sources</summary>
                    <ul className="mt-2 flex flex-col divide-y divide-line">
                      {sorted.map((rate) => (
                        <li key={rate.bank_id} className="flex flex-col gap-1 py-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-2 text-foreground">
                              {rate.bank_name}
                              {rate === best && sorted.length > 1 && (
                                <Badge variant="accent" className="px-1.5 py-0 text-[10px] leading-4">
                                  Best
                                </Badge>
                              )}
                            </span>
                            <span className="font-mono text-foreground">{rate.annual_rate.toFixed(2)}%</span>
                          </div>
                          <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                            {rate.effective_date && <>Effective {dateFormat.format(new Date(rate.effective_date))}</>}
                            {rate.source_url && (
                              <a
                                href={rate.source_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-link hover:underline"
                              >
                                Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            )}
                          </p>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
          </Card>
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Rates vary by bank, tenure, deposit amount and customer category (senior citizens may be offered different
        rates), and banks change them from time to time. Check the bank&apos;s current rate and terms before you invest.
        This is general information, not investment advice.
      </p>
    </div>
  );
}

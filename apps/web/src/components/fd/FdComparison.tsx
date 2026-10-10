"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Landmark } from "lucide-react";
import { FdBankSelector } from "./FdBankSelector";
import { FdRateChart } from "./FdRateChart";
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
  const selected = chosen ?? new Set(tenureRates.map((r) => r.bank_id));
  const shown = tenureRates.filter((r) => selected.has(r.bank_id));

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

      <div className="mb-6">
        <SegmentedControl
          options={TENURE_LABELS}
          value={FD_TENURES.find((t) => t.id === tenure)!.label}
          onChange={(label) => setTenure(FD_TENURES.find((t) => t.label === label)!.id)}
          className="max-w-full overflow-x-auto"
        />
      </div>

      {query.isPending ? (
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
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
        <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)] lg:items-start">
          <Card className="border-line bg-card p-4 sm:p-6">
            <FdBankSelector
              rates={tenureRates}
              selected={selected}
              onToggle={toggle}
              onSelectAll={() => setChosen(new Set(tenureRates.map((r) => r.bank_id)))}
              onClear={() => setChosen(new Set())}
            />
          </Card>

          <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
            <div className="mb-4">
              <h2 className="text-h2">Interest rate, % a year</h2>
              <p className="text-sm text-muted">
                {FD_TENURES.find((t) => t.id === tenure)!.label} · general customers · highest first
              </p>
            </div>
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
              <FdRateChart rates={shown} isSample={Boolean(data?.is_sample)} />
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

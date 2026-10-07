import Link from "next/link";
import { Scale } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatINR } from "@/lib/format";
import type { RegimeComparison } from "@/lib/dashboard/state";
import { EmptyPanel } from "./EmptyPanel";
import { SectionError, SectionSkeleton } from "./SectionStatus";

interface RegimeCardProps {
  status: "loading" | "error" | "ready";
  tax: RegimeComparison | null;
  /** Income is known, but tax couldn't be compared for it. */
  hasIncome: boolean;
  /** The return was filed after the due date, so only the new regime is allowed. */
  oldRegimeClosed?: boolean;
  onRetry: () => void;
}

export function RegimeCard({ status, tax, hasIncome, oldRegimeClosed = false, onRetry }: RegimeCardProps) {
  return (
    <Card className="lg:col-span-2">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-h2">Old vs. new regime</h3>
        <Link href="/tax-comparison">
          <Button variant="ghost" size="sm">
            Full comparison
          </Button>
        </Link>
      </div>

      {status === "loading" ? (
        <SectionSkeleton />
      ) : status === "error" ? (
        <SectionError message="We couldn't load your tax comparison." onRetry={onRetry} />
      ) : tax ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">Old regime</p>
              {tax.better === "old" && <Badge variant="accent">Recommended</Badge>}
            </div>
            <p className="mt-1 text-amount-lg">{formatINR(tax.oldTax)}</p>
          </div>
          <div className="rounded-md border border-border p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted">New regime</p>
              {tax.better === "new" && <Badge variant="accent">Recommended</Badge>}
            </div>
            <p className="mt-1 text-amount-lg">{formatINR(tax.newTax)}</p>
          </div>
        </div>
      ) : (
        <EmptyPanel
          icon={Scale}
          description={
            oldRegimeClosed
              ? "The old regime is closed for your AY 2026-27 return because the due date has passed, so only the new regime applies. You can still run a comparison to plan ahead."
              : hasIncome
                ? "We couldn't compare both tax regimes with your latest details. Run a comparison with your own numbers."
                : "Complete your income details to compare both tax regimes."
          }
          action={
            <Link href="/tax-comparison">
              <Button variant="secondary" size="sm">
                Start comparison
              </Button>
            </Link>
          }
        />
      )}
    </Card>
  );
}

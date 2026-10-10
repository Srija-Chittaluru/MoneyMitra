import type { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatTile } from "@/components/ui/StatTile";
import { cn } from "@/lib/cn";

interface StatCardProps {
  label: string;
  status: "loading" | "error" | "ready";
  /** A figure only when it has been calculated from real data; otherwise null. */
  amount: number | null;
  helpText?: string;
  emptyValue: string;
  emptyHint: string;
  icon?: LucideIcon;
  className?: string;
}

/** The existing stat tile when there is a real number; the same card, with an honest empty state, when there isn't. */
export function StatCard({ label, status, amount, helpText, emptyValue, emptyHint, icon: Icon, className }: StatCardProps) {
  if (status === "ready" && amount !== null) {
    return (
      <StatTile label={label} amount={amount} helpText={helpText} icon={Icon} className={cn("border-line", className)} />
    );
  }

  return (
    <Card className={cn("border-line", className)}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-field">
            <Icon className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
          </span>
        )}
        <p className="text-sm text-muted">{label}</p>
      </div>
      {status === "loading" ? (
        <div className="mt-2 flex flex-col gap-2" aria-busy="true" aria-label="Loading">
          <Skeleton className="h-9 w-3/4" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : status === "error" ? (
        <>
          <p className="mt-2 flex h-11 items-center text-h2 text-foreground">Unavailable</p>
          <p className="mt-1 text-sm text-muted">We couldn&apos;t load this right now.</p>
        </>
      ) : (
        <>
          <p className="mt-2 flex h-11 items-center text-h2 text-foreground">{emptyValue}</p>
          <p className="mt-1 text-sm text-muted">{emptyHint}</p>
        </>
      )}
    </Card>
  );
}

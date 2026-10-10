import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";

interface GoalProgressProps {
  /** Money actually put aside: initial savings plus recorded contributions. */
  funding: number;
  /** The inflation-adjusted cost; null when there's no current plan. */
  futureCost: number | null;
  className?: string;
}

/** Saved so far against the estimated cost on the target date, capped at 100%. */
export function GoalProgress({ funding, futureCost, className }: GoalProgressProps) {
  if (futureCost === null || futureCost <= 0) return null;
  const share = Math.min(1, funding / futureCost);
  const percent = Math.floor(share * 100);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="text-muted">
          {formatRupees(funding)} of {formatRupees(futureCost)}
        </span>
        <span className="font-semibold text-foreground">{percent}%</span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-surface-muted"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Saved towards the estimated cost"
      >
        <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}

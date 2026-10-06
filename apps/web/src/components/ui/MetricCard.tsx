import { cn } from "@/lib/cn";
import { formatINR } from "@/lib/format";

interface MetricCardProps {
  label: string;
  amount: number;
  changeLabel?: string;
  /** Relative bar heights (0-1) for a simple sparkline; the last bar is the highlighted one. */
  bars?: number[];
  className?: string;
}

export function MetricCard({ label, amount, changeLabel, bars, className }: MetricCardProps) {
  return (
    <div
      className={cn(
        "dark rounded-lg bg-surface p-6 text-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted">{label}</p>
        {changeLabel && (
          <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">
            {changeLabel}
          </span>
        )}
      </div>
      <p className="mt-2 text-amount-lg">{formatINR(amount)}</p>
      {bars && bars.length > 0 && (
        <div className="mt-6 flex items-end gap-1.5">
          {bars.map((height, index) => {
            const isLast = index === bars.length - 1;
            return (
              <span
                key={index}
                className={cn(
                  "flex-1 rounded-sm",
                  isLast ? "bg-accent" : "bg-surface-muted",
                )}
                style={{ height: `${Math.max(height, 0.08) * 40}px` }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

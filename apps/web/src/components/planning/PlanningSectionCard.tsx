import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import type { PlanningSection } from "@/lib/planning/types";

export function PlanningSectionCard({
  section,
  isSelected,
  onSelect,
}: {
  section: PlanningSection;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const isFullyUsed = section.headroom === 0;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onSelect();
        }
      }}
      className={cn("flex cursor-pointer flex-col gap-3 transition-shadow", isSelected && "ring-2 ring-border")}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-h2">{section.label}</h3>
        <Badge variant={isFullyUsed ? "success" : "warning"}>
          {isFullyUsed ? "Fully used" : `${formatRupees(section.headroom)} left`}
        </Badge>
      </div>

      <p className="text-sm text-muted">
        Declared <span className="font-medium text-foreground">{formatRupees(section.declared_amount)}</span>{" "}
        of the <span className="font-medium text-foreground">{formatRupees(section.cap)}</span> limit.
      </p>

      {!isFullyUsed && (
        <div className="rounded-md bg-surface-muted px-3 py-3">
          <p className="text-sm text-foreground">
            Invest about <span className="font-semibold">{formatRupees(section.monthly_target)}</span> a
            month to use this fully before the year ends.
          </p>
        </div>
      )}

      {isSelected ? (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Where this can go</p>
          <div className="flex max-h-64 flex-col gap-2 overflow-y-auto pr-1">
            {section.instruments.map((instrument) => (
              <div key={instrument.name} className="rounded-md border border-border px-3 py-2">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{instrument.name}</span>
                  <Badge variant="neutral">{instrument.type}</Badge>
                </div>
                <p className="text-xs text-muted">{instrument.description}</p>
                <p className="mt-1 text-xs text-muted">Lock-in: {instrument.lock_in}</p>
                <p className="mt-2 text-xs text-foreground">{instrument.why}</p>
                {instrument.link && (
                  <a
                    href={instrument.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(event) => event.stopPropagation()}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-text hover:underline"
                  >
                    Learn more <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted">Click to see where this can go</p>
      )}
    </Card>
  );
}

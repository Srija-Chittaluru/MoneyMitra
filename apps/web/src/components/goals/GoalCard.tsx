import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { formatDate } from "@/lib/goals/form";
import { goalTypeName } from "@/lib/goals/types";
import type { Goal } from "@/lib/goals/types";
import { AffordabilityBadge, GoalStatusBadge } from "./GoalBadges";
import { GoalProgress } from "./GoalProgress";

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 truncate font-semibold text-foreground">{value}</dd>
      {hint && <dd className="truncate text-xs text-muted">{hint}</dd>}
    </div>
  );
}

/** One goal in the list. Every figure comes from the API's latest calculation. */
export function GoalCard({ goal, refreshing }: { goal: Goal; refreshing?: boolean }) {
  const plan = goal.plan;
  const fundingHint =
    goal.contributions_total > 0
      ? `${formatRupees(goal.existing_savings)} at start + ${formatRupees(goal.contributions_total)} added`
      : "Saved at start";

  return (
    <Link
      href={`/goals/${goal.id}`}
      className="group block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
    >
      <Card
        className={cn(
          "flex h-full flex-col gap-4 border-line bg-card p-4 transition-colors group-hover:bg-hover sm:p-6",
          goal.status !== "active" && "opacity-80",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted">{goalTypeName(goal.goal_type)}</p>
            <h3 className="truncate text-h2">{goal.title}</h3>
            <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
              {formatDate(goal.target_date)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <GoalStatusBadge status={goal.status} />
            {goal.affordability && <AffordabilityBadge status={goal.affordability.status} />}
            <ChevronRight className="h-5 w-5 text-muted transition-transform group-hover:translate-x-0.5" />
          </div>
        </div>

        <dl className={cn("grid grid-cols-2 gap-x-4 gap-y-3", refreshing && "opacity-60")}>
          <Figure label="Cost today" value={formatRupees(goal.cost_today)} />
          <Figure label="Estimated cost then" value={plan ? formatRupees(plan.future_cost) : "—"} />
          <Figure label="Saved so far" value={formatRupees(goal.current_funding)} hint={fundingHint} />
          <Figure
            label="Needed each month"
            value={plan ? formatRupees(plan.monthly_needed) : "—"}
            hint={plan ? (plan.monthly_needed === 0 ? "Fully funded" : `for ${plan.months} months`) : undefined}
          />
        </dl>

        {plan ? (
          <GoalProgress funding={goal.current_funding} futureCost={plan.future_cost} className="mt-auto" />
        ) : (
          <p className="mt-auto text-sm text-muted">{goal.plan_issue}</p>
        )}
      </Card>
    </Link>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, Plus, Target } from "lucide-react";
import { AffordabilityBadge } from "@/components/goals/GoalBadges";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { formatDate } from "@/lib/goals/form";
import { nextMilestone } from "@/lib/goals/queries";
import type { Goal } from "@/lib/goals/types";
import { EmptyPanel } from "./EmptyPanel";
import { SectionError, SectionSkeleton } from "./SectionStatus";

interface NextMilestoneCardProps {
  status: "loading" | "error" | "ready";
  /** The user's goals from the Goals API (archived ones excluded). */
  goals: Goal[] | undefined;
  onRetry: () => void;
  className?: string;
}

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-muted">{label}</p>
      {/* Amounts wrap rather than truncate: a cut-off figure would misstate it. */}
      <p className="mt-0.5 break-words text-sm font-semibold text-foreground sm:text-base">{value}</p>
    </div>
  );
}

/** The active goal due soonest, with the same figures and progress as the Goals page. */
export function NextMilestoneCard({ status, goals, onRetry, className }: NextMilestoneCardProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const goal = goals ? nextMilestone(goals) : null;
  const othersActive = goals ? goals.filter((g) => g.status === "active").length - 1 : 0;

  function openCreate() {
    setFormKey((k) => k + 1);
    setCreating(true);
  }

  return (
    <Card className={cn("border-line", className)}>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-h2">Next milestone</h3>
        <Link href="/goals">
          <Button variant="ghost" size="sm">
            {othersActive > 0 ? `All goals (${othersActive + 1})` : "All goals"}
          </Button>
        </Link>
      </div>

      {status === "loading" ? (
        <SectionSkeleton lines={2} />
      ) : status === "error" ? (
        <SectionError message="We couldn't load your goals." onRetry={onRetry} />
      ) : goal === null ? (
        <EmptyPanel
          icon={Target}
          description="Planning for a car, a home or a trip? Create a goal to see what it will cost by then and what to put aside each month."
          action={
            <Button variant="secondary" size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create a goal
            </Button>
          }
        />
      ) : (
        <Link
          href={`/goals/${goal.id}`}
          className="flex flex-col gap-4 rounded-md border border-line bg-field p-4 transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:flex-row lg:items-center lg:gap-8"
        >
          <div className="min-w-0 lg:w-56 lg:shrink-0">
            <p className="truncate font-semibold text-foreground">{goal.title}</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
              <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
              {formatDate(goal.target_date)}
            </p>
          </div>

          {goal.plan ? (
            <>
              <div className="grid grid-cols-3 gap-4 lg:w-[26rem] lg:shrink-0">
                <Figure label="Estimated cost then" value={formatRupees(goal.plan.future_cost)} />
                <Figure label="Saved so far" value={formatRupees(goal.current_funding)} />
                <Figure
                  label="Each month"
                  value={goal.plan.monthly_needed === 0 ? "Funded" : formatRupees(goal.plan.monthly_needed)}
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <GoalProgress funding={goal.current_funding} futureCost={goal.plan.future_cost} />
                {goal.affordability && (
                  <div>
                    <AffordabilityBadge status={goal.affordability.status} />
                  </div>
                )}
              </div>
            </>
          ) : (
            // An active goal with no plan right now, e.g. its target month has arrived.
            <p className="text-sm text-muted">{goal.plan_issue}</p>
          )}
        </Link>
      )}

      {goal && (
        <p className="mt-3 text-xs text-muted">Future costs are estimates based on assumed rates, not guarantees.</p>
      )}

      <GoalFormDialog
        key={formKey}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(saved) => {
          setCreating(false);
          router.push(`/goals/${saved.id}`);
        }}
      />
    </Card>
  );
}

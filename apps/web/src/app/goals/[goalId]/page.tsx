"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArrowLeft, CalendarDays, CheckCircle2, Pencil, RotateCcw, Target, Trash2 } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { AffordabilityPanel } from "@/components/goals/AffordabilityPanel";
import { ContributionsPanel } from "@/components/goals/ContributionsPanel";
import { FinancialProfileCard } from "@/components/goals/FinancialProfileCard";
import { GoalStatusBadge } from "@/components/goals/GoalBadges";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";
import { GoalProgress } from "@/components/goals/GoalProgress";
import { PlanPanel } from "@/components/goals/PlanPanel";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { changeGoalStatus, deleteGoal, getGoal } from "@/lib/goals/api";
import type { GoalAction } from "@/lib/goals/api";
import { formatDate } from "@/lib/goals/form";
import { goalKeys, refreshGoals } from "@/lib/goals/queries";
import { useAuth } from "@/lib/auth/AuthContext";
import { goalTypeName } from "@/lib/goals/types";
import type { Goal, GoalStatus } from "@/lib/goals/types";

const NOT_ACTIVE: Record<Exclude<GoalStatus, "active">, string> = {
  completed: "This goal is completed, so its details and contributions are locked.",
  archived: "This goal is archived, so its details and contributions are locked and it doesn't count against your budget.",
};

function BackLink() {
  return (
    <Link href="/goals" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted hover:text-foreground">
      <ArrowLeft className="h-4 w-4" />
      All goals
    </Link>
  );
}

export default function GoalDetailPage() {
  const { goalId } = useParams<{ goalId: string }>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { status } = useAuth();
  // Wait for the session: on a fresh load the access token is restored by a refresh first.
  const query = useQuery({
    queryKey: goalKeys.detail(goalId),
    queryFn: () => getGoal(goalId),
    enabled: status === "authenticated",
  });
  const goal = query.data;

  const [editKey, setEditKey] = useState(0);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const statusMutation = useMutation<Goal, ApiError, GoalAction>({
    mutationFn: (action) => changeGoalStatus(goalId, action),
    onSuccess: (updated) => {
      queryClient.setQueryData(goalKeys.detail(goalId), updated);
      refreshGoals(queryClient);
    },
  });

  const deleteMutation = useMutation<void, ApiError, void>({
    mutationFn: () => deleteGoal(goalId),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: goalKeys.detail(goalId) });
      queryClient.removeQueries({ queryKey: goalKeys.contributions(goalId) });
      refreshGoals(queryClient);
      router.push("/goals");
    },
  });

  function closeDelete() {
    setConfirmDelete(false);
    deleteMutation.reset();
  }

  function archiveInstead() {
    closeDelete();
    statusMutation.mutate("archive");
  }

  if (query.isPending) {
    return (
      <AppShell title="Goals">
        <BackLink />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            <Skeleton className="h-96" />
            <Skeleton className="h-96" />
          </div>
        </div>
      </AppShell>
    );
  }

  if (query.isError || !goal) {
    const missing = query.error instanceof ApiError && query.error.status === 404;
    return (
      <AppShell title="Goals">
        <BackLink />
        {missing ? (
          <EmptyState icon={Target} title="Goal not found" description="It may have been deleted." />
        ) : (
          <ErrorState
            title="Couldn't load this goal"
            description={query.error?.message}
            action={
              <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
                Try again
              </Button>
            }
          />
        )}
      </AppShell>
    );
  }

  const active = goal.status === "active";
  // While a refetch is under way, the figures shown may be out of date.
  const refreshing = query.isFetching;
  const busy = statusMutation.isPending;

  return (
    <AppShell title="Goals">
      <BackLink />

      <Card className="mb-6 flex flex-col gap-4 border-line bg-card p-4 sm:p-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-muted">{goalTypeName(goal.goal_type)}</p>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-h1">{goal.title}</h1>
            <GoalStatusBadge status={goal.status} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4" strokeWidth={1.5} />
              Target {formatDate(goal.target_date)}
            </span>
            <span>Costs {formatRupees(goal.cost_today)} today</span>
            {goal.completed_at && <span>Completed {formatDate(goal.completed_at)}</span>}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {active && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setEditKey((k) => k + 1);
                setEditing(true);
              }}
            >
              <Pencil className="h-4 w-4" />
              Edit
            </Button>
          )}
          {active && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => statusMutation.mutate("complete")}>
              <CheckCircle2 className="h-4 w-4" />
              Mark complete
            </Button>
          )}
          {!active && (
            <Button size="sm" disabled={busy} onClick={() => statusMutation.mutate("reopen")}>
              <RotateCcw className="h-4 w-4" />
              Reopen
            </Button>
          )}
          {goal.status !== "archived" && (
            <Button variant="secondary" size="sm" disabled={busy} onClick={() => statusMutation.mutate("archive")}>
              <Archive className="h-4 w-4" />
              Archive
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        </div>
      </Card>

      {statusMutation.isError && (
        <p className="mb-4 rounded-md bg-error-bg px-4 py-3 text-sm text-error">{statusMutation.error.message}</p>
      )}

      {goal.status !== "active" && (
        <div className="mb-6 rounded-lg border border-line bg-surface-muted px-4 py-3 text-sm text-foreground">
          {NOT_ACTIVE[goal.status]} Reopen it to make changes.
        </div>
      )}

      {refreshing && (
        <p className="mb-4 text-sm text-muted" aria-live="polite">
          Updating the figures…
        </p>
      )}

      {active ? (
        <div
          className={cn(
            "grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:items-start",
            refreshing && "opacity-60 transition-opacity",
          )}
        >
          <div className="flex min-w-0 flex-col gap-4">
            {goal.plan ? (
              <>
                <Card className="border-line bg-card p-4 sm:p-6">
                  <GoalProgress funding={goal.current_funding} futureCost={goal.plan.future_cost} />
                </Card>
                <PlanPanel plan={goal.plan} />
                {goal.affordability && (
                  <>
                    <AffordabilityPanel affordability={goal.affordability} plan={goal.plan} goalType={goal.goal_type} />
                    {goal.affordability.status === "unknown" && <FinancialProfileCard />}
                  </>
                )}
              </>
            ) : (
              // An active goal without a plan, e.g. its target month has arrived.
              <Card className="flex flex-col gap-3 border-line bg-card p-4 sm:p-6">
                <h2 className="text-h2">No plan right now</h2>
                <p className="text-sm text-muted">{goal.plan_issue}</p>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-fit"
                  onClick={() => {
                    setEditKey((k) => k + 1);
                    setEditing(true);
                  }}
                >
                  Change the target date
                </Button>
              </Card>
            )}
          </div>
          <ContributionsPanel goal={goal} />
        </div>
      ) : (
        // Completed and archived goals have no plan (the banner above says why): just their history.
        <div className={cn("max-w-3xl", refreshing && "opacity-60 transition-opacity")}>
          <ContributionsPanel goal={goal} />
        </div>
      )}

      <GoalFormDialog
        key={editKey}
        open={editing}
        goal={goal}
        onClose={() => setEditing(false)}
        onSaved={(saved) => {
          queryClient.setQueryData(goalKeys.detail(goalId), saved);
          setEditing(false);
        }}
      />

      <Dialog open={confirmDelete} onClose={closeDelete} title="Delete goal?">
        {deleteMutation.isError && deleteMutation.error.status === 409 ? (
          <>
            <p className="mb-4 text-sm text-foreground">{deleteMutation.error.message}</p>
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeDelete}>
                Keep it
              </Button>
              {goal.status !== "archived" && <Button onClick={archiveInstead}>Archive instead</Button>}
            </div>
          </>
        ) : (
          <>
            <p className="mb-4 break-words text-sm text-muted">
              {goal.title} will be permanently deleted. Goals with recorded contributions can only be archived.
            </p>
            {deleteMutation.isError && <p className="mb-4 text-sm text-error">{deleteMutation.error.message}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button variant="secondary" onClick={closeDelete}>
                Cancel
              </Button>
              <Button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate()}>
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Button>
            </div>
          </>
        )}
      </Dialog>
    </AppShell>
  );
}

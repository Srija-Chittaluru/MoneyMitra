"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Plus, Target } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { FinancialProfileCard } from "@/components/goals/FinancialProfileCard";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalFormDialog } from "@/components/goals/GoalFormDialog";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Switch } from "@/components/ui/Switch";
import { listGoals } from "@/lib/goals/api";
import { goalKeys } from "@/lib/goals/queries";
import { useAuth } from "@/lib/auth/AuthContext";

export default function GoalsPage() {
  const router = useRouter();
  const [showArchived, setShowArchived] = useState(false);
  const [creating, setCreating] = useState(false);
  // Bumped on each open so the dialog remounts with a clean form.
  const [formKey, setFormKey] = useState(0);
  const { status } = useAuth();
  // Wait for the session: on a fresh load the access token is restored by a refresh first.
  const query = useQuery({
    queryKey: goalKeys.list(showArchived),
    queryFn: () => listGoals(showArchived),
    enabled: status === "authenticated",
  });
  const goals = query.data ?? [];

  function openCreate() {
    setFormKey((k) => k + 1);
    setCreating(true);
  }

  return (
    <AppShell title="Goals">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-muted">
          Plan for the milestones that matter: a car, a home, a trip. See what each will cost by then, what to put
          aside every month, and whether it fits your budget.
        </p>
        <Button size="sm" className="w-full shrink-0 sm:w-auto" onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Create goal
        </Button>
      </div>

      <FinancialProfileCard />

      <div className="mb-4 mt-8 flex items-center justify-between gap-3">
        <h2 className="text-h2">Your goals</h2>
        <label className="flex items-center gap-3 text-sm text-muted">
          Show archived
          <Switch checked={showArchived} onCheckedChange={setShowArchived} label="Show archived goals" />
        </label>
      </div>

      {query.isPending ? (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex flex-col gap-3 border-line bg-card">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-2 w-full" />
            </Card>
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState
          title="Couldn't load your goals"
          description={query.error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
              Try again
            </Button>
          }
        />
      ) : goals.length === 0 ? (
        <EmptyState
          icon={Target}
          title={showArchived ? "No goals yet" : "No goals in progress"}
          description="Create a goal to see what it will cost by your target date and how much to save each month."
          action={
            <Button size="sm" onClick={openCreate}>
              <Plus className="h-4 w-4" />
              Create goal
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} refreshing={query.isFetching} />
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Future costs and returns are estimates based on assumed rates, not guarantees. Open a goal to see the
        assumptions behind its figures.
      </p>

      <GoalFormDialog
        key={formKey}
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(goal) => {
          setCreating(false);
          router.push(`/goals/${goal.id}`);
        }}
      />
    </AppShell>
  );
}

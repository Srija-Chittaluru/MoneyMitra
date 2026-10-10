"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { PiggyBank, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { formatRupees } from "@/lib/format";
import { deleteContribution, listContributions } from "@/lib/goals/api";
import { formatDate } from "@/lib/goals/form";
import { goalKeys, refreshGoals } from "@/lib/goals/queries";
import type { Contribution, Goal } from "@/lib/goals/types";
import { ContributionDialog } from "./ContributionDialog";

/** What the user has actually put aside: their starting savings and every recorded contribution. */
export function ContributionsPanel({ goal }: { goal: Goal }) {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: goalKeys.contributions(goal.id), queryFn: () => listContributions(goal.id) });
  const [editing, setEditing] = useState<{ open: boolean; item?: Contribution; key: number }>({ open: false, key: 0 });
  const [pendingDelete, setPendingDelete] = useState<Contribution | null>(null);
  const canChange = goal.status === "active";

  const deleteMutation = useMutation<void, ApiError, Contribution>({
    mutationFn: (item) => deleteContribution(goal.id, item.id),
    onSuccess: () => {
      refreshGoals(queryClient);
      setPendingDelete(null);
    },
  });

  function openDialog(item?: Contribution) {
    setEditing((current) => ({ open: true, item, key: current.key + 1 }));
  }

  function closeDelete() {
    setPendingDelete(null);
    deleteMutation.reset();
  }

  // Newest first to read; the API returns them oldest first.
  const items = [...(query.data ?? [])].reverse();

  return (
    <Card className="flex flex-col gap-5 border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-h2">Saved so far</h2>
          <p className="text-sm text-muted">Money you&apos;ve actually put aside. Planned amounts aren&apos;t counted.</p>
        </div>
        {canChange && (
          <Button size="sm" onClick={() => openDialog()}>
            <Plus className="h-4 w-4" />
            Record contribution
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-3 gap-3">
        <div className="rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-muted">At start</dt>
          <dd className="mt-1 font-semibold text-foreground">{formatRupees(goal.existing_savings)}</dd>
        </div>
        <div className="rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-muted">Added since</dt>
          <dd className="mt-1 font-semibold text-foreground">{formatRupees(goal.contributions_total)}</dd>
        </div>
        <div className="rounded-md bg-surface-muted p-3">
          <dt className="text-xs text-muted">Total</dt>
          <dd className="mt-1 font-semibold text-foreground">{formatRupees(goal.current_funding)}</dd>
        </div>
      </dl>

      {!canChange && (
        <p className="text-sm text-muted">Reopen this goal to record, edit or delete contributions.</p>
      )}

      {query.isPending ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : query.isError ? (
        <div className="flex items-center gap-3">
          <p className="text-sm text-error">Couldn&apos;t load contributions.</p>
          <Button variant="secondary" size="sm" onClick={() => query.refetch()}>
            Try again
          </Button>
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-8 text-center">
          <PiggyBank className="h-6 w-6 text-muted" strokeWidth={1.5} />
          <p className="text-sm text-muted">No contributions recorded yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((item) => (
            <li key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{formatRupees(item.amount)}</p>
                <p className="truncate text-sm text-muted">
                  {formatDate(item.contributed_on)}
                  {item.note && <> &middot; {item.note}</>}
                </p>
              </div>
              {canChange && (
                <div className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="sm" aria-label="Edit contribution" onClick={() => openDialog(item)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" aria-label="Delete contribution" onClick={() => setPendingDelete(item)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      <ContributionDialog
        key={editing.key}
        open={editing.open}
        goalId={goal.id}
        contribution={editing.item}
        onClose={() => setEditing((current) => ({ ...current, open: false }))}
      />

      <Dialog open={pendingDelete !== null} onClose={closeDelete} title="Delete contribution?">
        <p className="mb-4 text-sm text-muted">
          {pendingDelete && `${formatRupees(pendingDelete.amount)} on ${formatDate(pendingDelete.contributed_on)}`} will
          be removed, and the plan recalculated.
        </p>
        {deleteMutation.isError && <p className="mb-4 text-sm text-error">{deleteMutation.error.message}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={closeDelete}>
            Cancel
          </Button>
          <Button
            disabled={deleteMutation.isPending}
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete)}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </Card>
  );
}

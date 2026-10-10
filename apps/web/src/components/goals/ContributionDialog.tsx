"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { ApiError } from "@/lib/api-client";
import { addContribution, updateContribution } from "@/lib/goals/api";
import { MAX_GOAL_AMOUNT, parseRupees, rupeeError } from "@/lib/goals/form";
import { refreshGoals } from "@/lib/goals/queries";
import type { Contribution, ContributionInput } from "@/lib/goals/types";
import { todayISO } from "@/lib/onboarding/validation";

type Field = keyof ContributionInput;

interface ContributionDialogProps {
  open: boolean;
  goalId: string;
  /** The contribution being edited; omit to record a new one. */
  contribution?: Contribution;
  onClose: () => void;
}

/** Money the user actually put aside: not a planned amount. Remount per open via `key`. */
export function ContributionDialog({ open, goalId, contribution, onClose }: ContributionDialogProps) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(contribution ? String(contribution.amount) : "");
  const [date, setDate] = useState(contribution?.contributed_on ?? todayISO());
  const [note, setNote] = useState(contribution?.note ?? "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const mutation = useMutation<Contribution, ApiError, ContributionInput>({
    mutationFn: (input) =>
      contribution ? updateContribution(goalId, contribution.id, input) : addContribution(goalId, input),
    onSuccess: () => {
      // Funding, progress, the plan and every goal's affordability all change.
      refreshGoals(queryClient);
      onClose();
    },
    onError: (error) => setErrors(error.fieldErrors as Partial<Record<Field, string>>),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const value = parseRupees(amount);
    const next: Partial<Record<Field, string>> = {};
    const amountError = rupeeError(value, { min: 1, max: MAX_GOAL_AMOUNT, required: true });
    if (amountError) next.amount = amountError;
    if (!date) next.contributed_on = "Choose the date you put the money aside.";
    else if (date > todayISO()) next.contributed_on = "A contribution can't be dated in the future.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    mutation.mutate({ amount: value as number, contributed_on: date, note: note.trim() || null });
  }

  const formError =
    mutation.isError && Object.keys(mutation.error.fieldErrors).length === 0 ? mutation.error.message : null;

  return (
    <Dialog open={open} onClose={onClose} title={contribution ? "Edit contribution" : "Record a contribution"}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <p className="text-sm text-muted">
          Record money you&apos;ve actually put aside for this goal. Returns or market gains aren&apos;t counted.
        </p>
        <Input
          id="contribution-amount"
          label="Amount (₹)"
          inputMode="numeric"
          placeholder="10,000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          error={errors.amount}
          className="bg-field border-line"
        />
        <Input
          id="contribution-date"
          type="date"
          label="Date"
          max={todayISO()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={errors.contributed_on}
          className="bg-field border-line"
        />
        <Input
          id="contribution-note"
          label="Note (optional)"
          placeholder="e.g. October SIP"
          maxLength={200}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          error={errors.note}
          className="bg-field border-line"
        />
        {formError && <p className="text-sm text-error">{formError}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : contribution ? "Save changes" : "Record"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

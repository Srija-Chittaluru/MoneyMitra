"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { ApiError } from "@/lib/api-client";
import { createGoal, updateGoal } from "@/lib/goals/api";
import {
  MAX_GOAL_AMOUNT,
  MIN_GOAL_COST,
  parseRupees,
  rupeeError,
  targetDateError,
} from "@/lib/goals/form";
import { refreshGoals } from "@/lib/goals/queries";
import { GOAL_TYPES } from "@/lib/goals/types";
import type { Goal, GoalInput, GoalType } from "@/lib/goals/types";

type Field = "title" | "goal_type" | "target_date" | "cost_today" | "existing_savings";

interface GoalFormDialogProps {
  open: boolean;
  /** The goal being edited; omit to create one. */
  goal?: Goal;
  onClose: () => void;
  onSaved: (goal: Goal) => void;
}

function isoMonthStart(monthsAhead: number): string {
  const today = new Date();
  const date = new Date(today.getFullYear(), today.getMonth() + monthsAhead, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;
}

const FIELD_CLASS = "bg-field border-line";

/** Remount per open (via `key`) so each open starts from the goal's saved values. */
export function GoalFormDialog({ open, goal, onClose, onSaved }: GoalFormDialogProps) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState(goal?.title ?? "");
  const [goalType, setGoalType] = useState<GoalType>(goal?.goal_type ?? "car");
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? "");
  const [cost, setCost] = useState(goal ? String(goal.cost_today) : "");
  const [savings, setSavings] = useState(goal ? String(goal.existing_savings) : "");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});

  const mutation = useMutation<Goal, ApiError, GoalInput>({
    mutationFn: (input) => (goal ? updateGoal(goal.id, input) : createGoal(input)),
    onSuccess: (saved) => {
      refreshGoals(queryClient);
      onSaved(saved);
    },
    onError: (error) => setErrors(error.fieldErrors as Partial<Record<Field, string>>),
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const costValue = parseRupees(cost);
    const savingsValue = parseRupees(savings);
    const next: Partial<Record<Field, string>> = {};
    if (!title.trim()) next.title = "Give the goal a name.";
    const dateError = targetDateError(targetDate);
    if (dateError) next.target_date = dateError;
    const costError = rupeeError(costValue, { min: MIN_GOAL_COST, max: MAX_GOAL_AMOUNT, required: true });
    if (costError) next.cost_today = costError;
    const savingsError = rupeeError(savingsValue, { min: 0, max: MAX_GOAL_AMOUNT, required: false });
    if (savingsError) next.existing_savings = savingsError;
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    mutation.mutate({
      title: title.trim(),
      goal_type: goalType,
      target_date: targetDate,
      cost_today: costValue as number,
      existing_savings: savingsValue ?? 0,
    });
  }

  // A message that isn't about one field (e.g. a conflict), shown under the form.
  const formError =
    mutation.isError && Object.keys(mutation.error.fieldErrors).length === 0 ? mutation.error.message : null;

  return (
    <Dialog open={open} onClose={onClose} title={goal ? "Edit goal" : "Create a goal"}>
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <Input
          id="goal-title"
          label="Goal name"
          placeholder="e.g. New car"
          maxLength={100}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          className={FIELD_CLASS}
        />
        <Select
          id="goal-type"
          label="Type"
          value={goalType}
          onChange={(e) => setGoalType(e.target.value as GoalType)}
          error={errors.goal_type}
          className={FIELD_CLASS}
        >
          {GOAL_TYPES.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </Select>
        <Input
          id="goal-target-date"
          type="date"
          label="Target date"
          min={isoMonthStart(1)}
          max={isoMonthStart(480)}
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          error={errors.target_date}
          className={FIELD_CLASS}
        />
        <Input
          id="goal-cost"
          label="What it costs today (₹)"
          inputMode="numeric"
          placeholder="8,00,000"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
          error={errors.cost_today}
          hint={errors.cost_today ? undefined : "In today's prices. We estimate what it will cost by your target date."}
          className={FIELD_CLASS}
        />
        <Input
          id="goal-savings"
          label="Already saved for this goal (₹)"
          inputMode="numeric"
          placeholder="0"
          value={savings}
          onChange={(e) => setSavings(e.target.value)}
          error={errors.existing_savings}
          hint={errors.existing_savings ? undefined : "Optional. Counted as it is, with no assumed growth."}
          className={FIELD_CLASS}
        />

        {formError && <p className="text-sm text-error">{formError}</p>}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : goal ? "Save changes" : "Create goal"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

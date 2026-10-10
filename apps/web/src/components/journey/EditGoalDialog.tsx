"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import type { GoalIn, GoalOut } from "@/lib/journey/goalsTypes";

/** Edits a goal already on the backend — same fields as creation, pre-filled, via `PUT /goals/{id}`. */
export function EditGoalDialog({
  goal,
  onClose,
  onSave,
}: {
  goal: GoalOut | null;
  onClose: () => void;
  onSave: (input: GoalIn) => Promise<unknown>;
}) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [month, setMonth] = useState("");
  const [existingSavings, setExistingSavings] = useState("");
  const [loanPct, setLoanPct] = useState("");
  const [saving, setSaving] = useState(false);

  // Re-seed the form whenever a different goal is opened for editing — adjusting state during
  // render (rather than in an effect) when the identity prop changes, same pattern as AddGoalModal.
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (goal && goal.id !== seededFor) {
    setSeededFor(goal.id);
    setTitle(goal.title);
    setAmount(goal.cost_today != null ? String(goal.cost_today) : "");
    setMonth(goal.target_date ? goal.target_date.slice(0, 7) : "");
    setExistingSavings(String(goal.existing_savings));
    setLoanPct(String(goal.loan_pct));
  }

  if (!goal) return null;

  const canSave = title.trim().length > 0;

  async function handleSave() {
    if (!goal || !canSave) return;
    const parsedAmount = amount.trim() === "" ? null : Number(amount);
    const parsedLoanPct = loanPct.trim() === "" ? 0 : Math.max(0, Math.min(100, Number(loanPct)));
    const input: GoalIn = {
      title: title.trim(),
      goal_type: goal.goal_type,
      target_date: month.trim() === "" ? null : `${month}-15`,
      cost_today: parsedAmount != null && !Number.isNaN(parsedAmount) ? parsedAmount : null,
      existing_savings: existingSavings.trim() === "" ? 0 : Number(existingSavings),
      loan_pct: Number.isNaN(parsedLoanPct) ? 0 : parsedLoanPct,
    };
    setSaving(true);
    try {
      await onSave(input);
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={goal != null} onClose={onClose} title="Edit goal">
      <div className="flex flex-col gap-4">
        <Input label="Title" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Amount"
            type="number"
            inputMode="numeric"
            placeholder="Not set yet"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <Input label="Target month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input
            label="Already saved"
            type="number"
            inputMode="numeric"
            value={existingSavings}
            onChange={(e) => setExistingSavings(e.target.value)}
          />
          <Input
            label="% funded by loan"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={loanPct}
            onChange={(e) => setLoanPct(e.target.value)}
          />
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Button variant="secondary" size="sm" className="rounded-full" onClick={onClose}>
            Cancel
          </Button>
          <div className="flex-1" />
          <Button variant="primary" size="sm" className="rounded-full" disabled={!canSave || saving} onClick={handleSave}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

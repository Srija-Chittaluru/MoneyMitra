"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";
import { GOAL_KIND_OPTIONS, type GoalKind } from "@/lib/journey/goals";
import type { GoalIn } from "@/lib/journey/goalsTypes";
import { monthIndexToIsoDate } from "@/lib/journey/wizardLogic";
import type { NonGoalKind } from "@/lib/journey/state";

const MONTH_OPTIONS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function yearOptions(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 17 }, (_, i) => current - 1 + i);
}

export function AddGoalModal({
  open,
  onClose,
  onAddGoal,
  onAddItem,
}: {
  open: boolean;
  onClose: () => void;
  /** kind === "goal": created for real on the backend. */
  onAddGoal: (input: GoalIn) => Promise<unknown>;
  /** Any other kind: a local event/note, same as today. */
  onAddItem: (item: { kind: NonGoalKind; title: string; date?: number | null }) => void;
}) {
  const [kind, setKind] = useState<GoalKind | null>(null);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [noDate, setNoDate] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Reset the form each time the modal transitions to open, for a fresh
  // entry — Dialog keeps this content mounted even while closed, so this
  // can't be a prop default. Adjusting state during render (rather than in
  // an effect) when a prop changes is the React-recommended pattern for this.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setKind(null);
      setTitle("");
      setAmount("");
      setNoDate(false);
      setMonth("");
      setYear("");
      setSubmitting(false);
    }
  }

  const canSubmit = kind != null && title.trim().length > 0 && (noDate || (month !== "" && year !== ""));

  async function handleSubmit() {
    if (!kind || !canSubmit) return;
    const date = noDate ? null : Number(year) * 12 + Number(month);

    if (kind === "goal") {
      const input: GoalIn = { title: title.trim(), goal_type: "custom", target_date: date != null ? monthIndexToIsoDate(date) : null };
      if (amount.trim() !== "") {
        const parsed = Number(amount);
        if (!Number.isNaN(parsed) && parsed > 0) input.cost_today = parsed;
      }
      setSubmitting(true);
      try {
        await onAddGoal(input);
      } finally {
        setSubmitting(false);
      }
    } else {
      onAddItem({ kind, title: title.trim(), date });
    }
    onClose();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Add to your journey">
      {kind == null ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted">What kind of thing is this?</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {GOAL_KIND_OPTIONS.map((opt) => (
              <button
                key={opt.kind}
                type="button"
                onClick={() => setKind(opt.kind)}
                className="flex flex-col gap-1 rounded-xl border border-line bg-field p-3 text-left transition-colors hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50"
              >
                <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                <span className="text-xs text-muted">{opt.sub}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <Input
            label="Title"
            placeholder="e.g. Buy a car"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            autoFocus
          />

          {kind === "goal" && (
            <Input
              label="Amount (optional)"
              type="number"
              inputMode="numeric"
              placeholder="Total you're saving toward"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          )}

          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={noDate}
              onChange={(e) => setNoDate(e.target.checked)}
              className="h-4 w-4 rounded border-line accent-[#3155E0]"
            />
            I don&apos;t know the date yet
          </label>

          {!noDate && (
            <div className="grid grid-cols-2 gap-3">
              <Select label="Month" value={month} onChange={(e) => setMonth(e.target.value)}>
                <option value="" disabled>
                  Month
                </option>
                {MONTH_OPTIONS.map((label, i) => (
                  <option key={label} value={i}>
                    {label}
                  </option>
                ))}
              </Select>
              <Select label="Year" value={year} onChange={(e) => setYear(e.target.value)}>
                <option value="" disabled>
                  Year
                </option>
                {yearOptions().map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="mt-2 flex items-center gap-3">
            <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setKind(null)}>
              Change type
            </Button>
            <div className="flex-1" />
            <Button
              variant="primary"
              size="sm"
              className={cn("rounded-full", !canSubmit && "opacity-50")}
              disabled={!canSubmit || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Adding…" : "Add to journey"}
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

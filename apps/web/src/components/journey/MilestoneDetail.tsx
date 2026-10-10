import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { EditGoalDialog } from "@/components/journey/EditGoalDialog";
import { ApiError } from "@/lib/api-client";
import type { ContributionIn, FinancialProfile, GoalOut } from "@/lib/journey/goalsTypes";
import type { JourneyMilestone } from "@/lib/journey/types";
import { useContributions, useGoals } from "@/lib/journey/useGoals";
import { affordabilityOptions, cmp } from "@/lib/journey/wizardLogic";

const STATUS_LABEL: Record<string, string> = {
  affordable: "On track",
  tight: "Tight, but workable",
  unaffordable: "Doesn't fit yet",
  unknown: "Income needs confirming",
};

/** The goal's funding so far against what it will actually cost, plus any share expected via a loan. */
function FundingProgress({ plan, currentFunding }: { plan: NonNullable<GoalOut["plan"]>; currentFunding: number }) {
  const pct = plan.future_cost > 0 ? Math.min(100, Math.round((currentFunding / plan.future_cost) * 100)) : 0;
  return (
    <div className="mt-4 flex flex-col gap-1.5">
      <p className="text-sm text-foreground">
        {cmp(currentFunding)} saved of {cmp(plan.future_cost)} needed
        {plan.financed_by_loan > 0 && <> · {cmp(plan.financed_by_loan)} via loan</>}
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-field">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** The backend's own explanation of how "needed per month" was worked out — collapsed by default, not new copy. */
function PlanReasoning({ plan }: { plan: NonNullable<GoalOut["plan"]> }) {
  return (
    <details className="mt-3 text-sm text-foreground">
      <summary className="cursor-pointer select-none text-xs font-medium text-muted hover:text-foreground">
        How this is worked out
      </summary>
      <div className="mt-2 flex flex-col gap-2 border-l-2 border-line pl-3">
        <p>
          <span className="font-semibold">{plan.approach.label}</span> approach ({plan.approach.risk} risk):{" "}
          {plan.approach.suggestion}.
        </p>
        <ul className="list-disc space-y-1 pl-4 text-sm text-muted">
          {plan.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <p className="text-xs text-muted">{plan.disclosure}</p>
      </div>
    </details>
  );
}

/** Logged contributions toward a goal, plus a compact form to add one — backed by `useContributions`. */
function ContributionsSection({ goalId }: { goalId: string }) {
  const { contributions, isLoading, addContribution, deleteContribution } = useContributions(goalId);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const canAdd = amount.trim() !== "" && Number(amount) > 0 && date.trim() !== "";

  async function handleAdd() {
    if (!canAdd) return;
    const input: ContributionIn = { amount: Number(amount), contributed_on: date, note: note.trim() || null };
    setSubmitting(true);
    try {
      await addContribution(input);
      setAmount("");
      setDate("");
      setNote("");
    } catch (err) {
      window.alert(err instanceof ApiError ? err.message : "Couldn't add that contribution. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Contributions</p>

      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : contributions.length === 0 ? (
        <p className="text-sm text-muted">No contributions logged yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {contributions.map((c) => (
            <div key={c.id} className="flex items-center gap-3.5 rounded-2xl border border-line bg-field py-2.5 pl-4 pr-3">
              <div className="min-w-0 flex-1">
                <div className="text-sm font-semibold text-foreground">{cmp(c.amount)}</div>
                <div className="text-xs text-muted">
                  {c.contributed_on}
                  {c.note && <> · {c.note}</>}
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  deleteContribution(c.id).catch((err) =>
                    window.alert(err instanceof ApiError ? err.message : "Couldn't delete that contribution. Please try again."),
                  )
                }
                className="text-xs font-medium text-muted hover:text-error"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Input
          label="Amount"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 10000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
        <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <Input label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} />
      </div>
      <Button variant="secondary" size="sm" className="self-start rounded-full" disabled={!canAdd || submitting} onClick={handleAdd}>
        {submitting ? "Adding…" : "Add contribution"}
      </Button>
    </div>
  );
}

/** Reliability values (see the backend's `take_home.py`) for which the figures shown are a guess, not the user's own. */
const UNCONFIRMED_RELIABILITY = new Set(["stale", "expected_only", "incomplete", "unavailable"]);

/** A compact inline form so "confirm your income" is something the user can do right here, not just read about. */
function ConfirmIncomeForm({
  defaultTakeHome,
  takeHomeIsFromRealData,
  onConfirm,
}: {
  /** Only a genuine estimate from the user's own data (tax comparison, ITR, profile) — never a generic guess. */
  defaultTakeHome?: number;
  takeHomeIsFromRealData: boolean;
  onConfirm: (input: { monthly_take_home: number; monthly_expenses: number }) => Promise<unknown>;
}) {
  const [takeHome, setTakeHome] = useState(defaultTakeHome != null ? String(defaultTakeHome) : "");
  // Deliberately never pre-filled: the only "expenses" figure MoneyMitra might have is a flat
  // 60%-of-income assumption with nothing to do with this user — pre-filling it risks the user
  // clicking Save without noticing and locking in a fabricated number as their confirmed figure.
  const [expenses, setExpenses] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const th = Number(takeHome);
  const ex = Number(expenses);
  const canSave = takeHome.trim() !== "" && expenses.trim() !== "" && th > 0 && ex >= 0 && !Number.isNaN(th) && !Number.isNaN(ex);

  async function handleSave() {
    if (!canSave) return;
    setSaving(true);
    try {
      await onConfirm({ monthly_take_home: th, monthly_expenses: ex });
      setSaved(true);
    } finally {
      setSaving(false);
    }
  }

  if (saved) {
    return <p className="text-sm text-success">Saved — this goal will recheck against your real numbers.</p>;
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-line bg-field p-3">
      <p className="text-sm text-foreground">Confirm your actual monthly numbers to check this goal properly:</p>
      {takeHomeIsFromRealData && defaultTakeHome != null && (
        <p className="text-xs text-muted">
          Take-home is started from your last tax comparison — adjust it if your pay has changed. Expenses has no
          estimate of yours to start from, so enter your real figure.
        </p>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Input
          label="Monthly take-home"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 85000"
          value={takeHome}
          onChange={(e) => setTakeHome(e.target.value)}
        />
        <Input
          label="Monthly expenses"
          type="number"
          inputMode="numeric"
          placeholder="e.g. 45000"
          value={expenses}
          onChange={(e) => setExpenses(e.target.value)}
        />
      </div>
      <Button variant="primary" size="sm" className="self-start rounded-full" disabled={!canSave || saving} onClick={handleSave}>
        {saving ? "Saving…" : "Save and recheck"}
      </Button>
    </div>
  );
}

/** A real backend goal's affordability — status, headroom, and a concrete alternative when it doesn't comfortably fit. */
function AffordabilitySection({
  goal,
  financialProfile,
  onConfirmIncome,
}: {
  goal: GoalOut;
  financialProfile?: FinancialProfile;
  onConfirmIncome?: (input: { monthly_take_home: number; monthly_expenses: number }) => Promise<unknown>;
}) {
  const a = goal.affordability;
  if (!a) return null;

  const unconfirmed = a.status === "unknown" && UNCONFIRMED_RELIABILITY.has(a.take_home.reliability);

  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-center justify-between gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Affordability</p>
        <p className="text-sm font-semibold text-foreground">{STATUS_LABEL[a.status] ?? a.status}</p>
      </div>

      {a.breakdown && (
        <div className="flex flex-col gap-1.5">
          {unconfirmed && (
            <p className="text-xs text-muted">
              These figures are an estimate from {a.take_home.source === "tax_comparison" ? "your tax comparison" : "your profile"}
              {a.take_home.financial_year ? ` (FY ${a.take_home.financial_year})` : ""}, not your confirmed numbers — treat them as a
              rough guide until you confirm below.
            </p>
          )}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
            <div className="bg-card px-3 py-2">
              <p className="text-xs text-muted">Take-home</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{cmp(a.breakdown.take_home)}</p>
            </div>
            <div className="bg-card px-3 py-2">
              <p className="text-xs text-muted">Expenses</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{cmp(a.breakdown.expenses)}</p>
            </div>
            <div className="bg-card px-3 py-2">
              <p className="text-xs text-muted">Other goals</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{cmp(a.breakdown.commitments)}</p>
            </div>
            <div className="bg-card px-3 py-2">
              <p className="text-xs text-muted">Left over</p>
              <p className="mt-0.5 font-mono text-sm text-foreground">{cmp(a.breakdown.available)}</p>
            </div>
          </div>
        </div>
      )}

      {affordabilityOptions(goal).map((o) => (
        <p key={o.key} className="text-sm text-foreground">
          <strong>{o.label}:</strong> {o.detail}
        </p>
      ))}
      {!a.later_date && !a.lower_cost && !a.loan && a.reasons[0] && <p className="text-sm text-muted">{a.reasons[0]}</p>}
      {a.schedule && <p className="text-sm text-muted">{a.schedule.description}</p>}
      {a.notes.map((note) => (
        <p key={note} className="text-xs text-muted">
          {note}
        </p>
      ))}

      {a.status === "unknown" && onConfirmIncome && (
        <ConfirmIncomeForm
          defaultTakeHome={financialProfile?.monthly_take_home ?? a.take_home.monthly ?? undefined}
          takeHomeIsFromRealData={financialProfile?.monthly_take_home != null || a.take_home.monthly != null}
          onConfirm={onConfirmIncome}
        />
      )}
    </div>
  );
}

const ACTION_BUTTON = "text-xs font-medium text-muted hover:text-foreground";

export function MilestoneDetail({
  milestone,
  goal,
  financialProfile,
  onConfirmIncome,
  onDelete,
}: {
  milestone: JourneyMilestone;
  goal?: GoalOut;
  financialProfile?: FinancialProfile;
  onConfirmIncome?: (input: { monthly_take_home: number; monthly_expenses: number }) => Promise<unknown>;
  onDelete?: () => void;
}) {
  const Icon = milestone.icon;
  const { updateGoal, archiveGoal, completeGoal, reopenGoal } = useGoals();
  const [editing, setEditing] = useState(false);

  async function runStatusAction(action: () => Promise<unknown>, failureMessage: string) {
    try {
      await action();
    } catch {
      window.alert(failureMessage);
    }
  }

  return (
    <Card className="bg-card border-line lg:h-[640px] lg:overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Icon className="h-3.5 w-3.5 text-accent-text" strokeWidth={2} />
          </span>
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
            {milestone.when === "now" ? "Now" : milestone.when === "past" ? "Happened" : "Ahead"}
          </p>
        </div>
        {goal && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setEditing(true)} className={ACTION_BUTTON}>
              Edit
            </button>
            {goal.status === "active" ? (
              <>
                <button
                  type="button"
                  onClick={() => runStatusAction(() => completeGoal(goal.id), "Couldn't mark this goal complete. Please try again.")}
                  className={ACTION_BUTTON}
                >
                  Mark complete
                </button>
                <button
                  type="button"
                  onClick={() => runStatusAction(() => archiveGoal(goal.id), "Couldn't archive this goal. Please try again.")}
                  className={ACTION_BUTTON}
                >
                  Archive
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => runStatusAction(() => reopenGoal(goal.id), "Couldn't reopen this goal. Please try again.")}
                className={ACTION_BUTTON}
              >
                Reopen
              </button>
            )}
            {onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(`Remove "${milestone.title}" from your journey?`)) onDelete();
                }}
                className="text-xs font-medium text-muted hover:text-error"
              >
                Remove
              </button>
            )}
          </div>
        )}
        {!goal && onDelete && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Remove "${milestone.title}" from your journey?`)) onDelete();
            }}
            className="text-xs font-medium text-muted hover:text-error"
          >
            Remove
          </button>
        )}
      </div>
      <h2 className="mt-2 text-h1">{milestone.title}</h2>

      {milestone.detailLines.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          {milestone.detailLines.map((line) => (
            <div key={line.label} className="bg-card px-4 py-3">
              <p className="text-xs text-muted">{line.label}</p>
              <p className="mt-1 font-mono text-sm text-foreground">{line.value}</p>
            </div>
          ))}
        </div>
      )}

      {milestone.note && <p className="mt-4 text-sm text-foreground">{milestone.note}</p>}

      {goal?.plan && (
        <>
          <p className="mt-3 text-xs text-muted">
            &ldquo;Needed per month&rdquo; comes from the amount, target date and an assumed investment return — it doesn&apos;t use your
            income. Affordability below is the separate check against what you actually earn and spend.
          </p>
          <FundingProgress plan={goal.plan} currentFunding={goal.current_funding} />
          <PlanReasoning plan={goal.plan} />
        </>
      )}

      {goal && <AffordabilitySection goal={goal} financialProfile={financialProfile} onConfirmIncome={onConfirmIncome} />}

      {goal && <ContributionsSection goalId={goal.id} />}

      {milestone.actionLabel && milestone.actionHref && (
        <Link href={milestone.actionHref} className="mt-4 inline-block">
          <Button variant="secondary" size="sm" className="rounded-full">
            {milestone.actionLabel}
          </Button>
        </Link>
      )}

      <EditGoalDialog goal={editing ? (goal ?? null) : null} onClose={() => setEditing(false)} onSave={(input) => updateGoal(goal!.id, input)} />
    </Card>
  );
}

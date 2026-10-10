"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { AddGoalModal } from "@/components/journey/AddGoalModal";
import { CharacterPicker } from "@/components/journey/CharacterPicker";
import { GoalsCommitmentSummary } from "@/components/journey/GoalsCommitmentSummary";
import { JourneyEmptyState } from "@/components/journey/JourneyEmptyState";
import { JourneyOnboarding } from "@/components/journey/JourneyOnboarding";
import { JourneyTimeline } from "@/components/journey/JourneyTimeline";
import { MilestoneDetail } from "@/components/journey/MilestoneDetail";
import { NextMovePanel } from "@/components/journey/NextMovePanel";
import { StepRank } from "@/components/journey/onboarding/StepRank";
import { buildMilestones, buildUndatedEntries, pickNextMove } from "@/lib/journey/build";
import { useJourneyData } from "@/lib/journey/useJourneyData";
import { useJourneyState } from "@/lib/journey/useJourneyState";
import { cmp } from "@/lib/journey/wizardLogic";
import { useTaxDeadline } from "@/lib/useTaxDeadline";
import { useAuth } from "@/lib/auth/AuthContext";
import { cn } from "@/lib/cn";

/** A real, conditional heads-up — shown only when the tax deadline is genuinely close. */
function JourneyInsight({ taxDeadlineDays }: { taxDeadlineDays: number }) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || taxDeadlineDays > 45) return null;

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-card px-4 py-3">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#3155E0]/10 dark:bg-[#7B9AFF]/10">
        <Sparkles className="h-4 w-4 text-[#3155E0] dark:text-[#7B9AFF]" strokeWidth={1.75} />
      </span>
      <p className="flex-1 text-sm text-foreground">Only {taxDeadlineDays} days left in the tax-saving window.</p>
      <Link href="/tax-planning">
        <Button variant="secondary" size="sm" className="rounded-full">
          See your tax plan
        </Button>
      </Link>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        className="text-muted hover:text-foreground"
      >
        ×
      </button>
    </div>
  );
}

/**
 * Past, present and what's ahead — built from the user's real MoneyMitra
 * data (signup date, document/tax activity, the live tax-saving deadline,
 * their actual recommendations) plus their own backend-persisted goals and
 * locally-tracked events, built via the onboarding wizard or the
 * "+ Add to my journey" modal.
 */
function JourneyView() {
  const { user } = useAuth();
  const { summary, documents, recommendations } = useJourneyData();
  const { days: taxDeadlineDays, fyLabel: taxDeadlineFyLabel } = useTaxDeadline();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [rankOpen, setRankOpen] = useState(false);
  const journey = useJourneyState();

  const loading = summary.isPending || documents.isPending || recommendations.isPending;

  if (!user || loading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64" />
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-40" />
          <Skeleton className="h-40" />
        </div>
      </div>
    );
  }

  const monthlyIncome = summary.data?.annual_income != null ? Math.round(summary.data.annual_income / 12) : undefined;

  if (journey.phase === "empty") {
    return (
      <JourneyEmptyState
        onStart={() => journey.startJourney({ income: monthlyIncome })}
        onLater={() => journey.later({ income: monthlyIncome })}
      />
    );
  }

  if (journey.phase === "onboarding") {
    return <JourneyOnboarding journey={journey} />;
  }

  const state = journey.state!;
  const milestones = buildMilestones({
    user,
    documents: documents.data ?? [],
    summary: summary.data,
    taxDeadlineDays,
    taxDeadlineFyLabel,
    items: state.items,
    goals: journey.goals,
  });
  const undatedEntries = buildUndatedEntries(state.items, journey.goals);

  const nowMilestone = milestones.find((m) => m.when === "now") ?? milestones[0];
  const selected =
    milestones.find((m) => m.id === selectedId) ?? undatedEntries.find((m) => m.id === selectedId) ?? nowMilestone;
  const nextMove = pickNextMove(recommendations.data);
  const activeGoals = journey.goals.filter((g) => g.status === "active");
  const rankedRows = activeGoals.map((g) => ({
    id: g.id,
    title: g.title,
    sub: g.cost_today != null ? cmp(g.cost_today) : undefined,
  }));
  const selectedGoal = activeGoals.find((g) => `goal-${g.id}` === selected.id);
  const inactiveGoals = journey.goals.filter((g) => g.status !== "active");

  // Only the user's own goals/events are removable — signup, document activity, "now"
  // and the tax deadline are derived from real account data, not something to delete.
  let onDeleteSelected: (() => void) | undefined;
  if (selected.id.startsWith("goal-")) {
    const goalId = selected.id.slice("goal-".length);
    onDeleteSelected = async () => {
      try {
        await journey.deleteGoal(goalId);
        setSelectedId(null);
      } catch (err) {
        // The backend refuses to delete a goal with logged contributions and says so —
        // surface that message (it tells the user to archive instead) rather than a generic one.
        window.alert(err instanceof ApiError ? err.message : "Couldn't remove this goal. Please try again.");
      }
    };
  } else if (selected.id.startsWith("item-")) {
    const itemId = selected.id.slice("item-".length);
    onDeleteSelected = () => {
      journey.removeItem(itemId);
      setSelectedId(null);
    };
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">My journey</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            Past, present and what&apos;s ahead
          </h1>
          <p className="mt-1 text-sm text-muted">Select any point on the timeline to see what it means for you.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" className="rounded-full" onClick={() => setPickerOpen((v) => !v)}>
            Change character
          </Button>
          <Button
            variant="secondary"
            size="sm"
            className="rounded-full"
            disabled={rankedRows.length < 2}
            title={rankedRows.length < 2 ? "Add at least two goals to rank them" : undefined}
            onClick={() => setRankOpen(true)}
          >
            Rank goals
          </Button>
          <Button variant="primary" size="sm" className="rounded-full" onClick={() => setAddOpen(true)}>
            + Add to my journey
          </Button>
        </div>
      </div>

      <JourneyInsight taxDeadlineDays={taxDeadlineDays} />

      {(pickerOpen || state.character == null) && (
        <CharacterPicker
          selectedId={state.character}
          onSelect={(id) => {
            journey.setCharacter(id);
            setPickerOpen(false);
          }}
        />
      )}

      {activeGoals.length > 0 && <GoalsCommitmentSummary goals={activeGoals} financialProfile={journey.financialProfile} />}

      <JourneyTimeline
        milestones={milestones}
        selectedId={selected.id}
        onSelect={setSelectedId}
        characterId={state.character}
        onAddGoal={() => setAddOpen(true)}
      />

      {undatedEntries.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">Still deciding when?</p>
          <div className="flex flex-wrap gap-2">
            {undatedEntries.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSelectedId(item.id)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-medium transition-colors",
                  item.id === selected.id
                    ? "border-[#3155E0] text-foreground dark:border-[#7B9AFF]"
                    : "border-line text-muted hover:border-[#3155E0]/50 hover:text-foreground dark:hover:border-[#7B9AFF]/50",
                )}
              >
                {item.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2 lg:items-stretch">
        <MilestoneDetail
          // Remounts fresh on every selection change — without this, a milestone's local
          // state (the edit dialog, an in-progress contribution form, an expanded "how this
          // is worked out" section) could leak into whichever milestone is clicked next.
          key={selected.id}
          milestone={selected}
          goal={selectedGoal}
          financialProfile={journey.financialProfile}
          onConfirmIncome={journey.updateFinancialProfile}
          onDelete={onDeleteSelected}
        />
        <NextMovePanel nextMove={nextMove} selectedGoal={selectedGoal} />
      </div>

      {inactiveGoals.length > 0 && (
        <details className="rounded-2xl border border-line bg-card p-4">
          <summary className="cursor-pointer select-none font-mono text-xs uppercase tracking-[0.14em] text-muted hover:text-foreground">
            Archived &amp; completed goals ({inactiveGoals.length})
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {inactiveGoals.map((g) => (
              <div key={g.id} className="flex items-center gap-3.5 rounded-2xl border border-line bg-field py-2.5 pl-4 pr-3">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{g.title}</div>
                  <div className="text-xs capitalize text-muted">{g.status}</div>
                </div>
                <button
                  type="button"
                  onClick={() => journey.reopenGoal(g.id).catch(() => window.alert("Couldn't reopen this goal. Please try again."))}
                  className="text-xs font-medium text-muted hover:text-foreground"
                >
                  Reopen
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <p className="text-xs text-muted">
        Built from your own MoneyMitra data — signup, documents, income summary and recommendations.
      </p>

      <AddGoalModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onAddGoal={(input) => journey.createGoal(input)}
        onAddItem={journey.addItem}
      />

      <Dialog open={rankOpen} onClose={() => setRankOpen(false)} title="Rank your goals">
        <StepRank rows={rankedRows} onReorder={(ids) => journey.reorderGoals(ids)} />
      </Dialog>
    </div>
  );
}

export default function JourneyPage() {
  return (
    <AppShell title="My Journey">
      <JourneyView />
    </AppShell>
  );
}

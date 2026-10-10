"use client";

import { Button } from "@/components/ui/Button";
import { DEFAULT_CHARACTER_ID } from "@/lib/journey/characters";
import { GT, LOAN_OK, EVENT_TYPES, GOAL_TYPES, CUSTOM_T, type GoalTypeId } from "@/lib/journey/goalTypes";
import type { GoalOut } from "@/lib/journey/goalsTypes";
import type { DraftGoal } from "@/lib/journey/state";
import type { JourneyStateHook } from "@/lib/journey/useJourneyState";
import { affordabilitySuggestion, cmp, inr, isoDateToMonthIndex, ml, nowIndex } from "@/lib/journey/wizardLogic";
import { StepCards } from "./onboarding/StepCards";
import { StepChips } from "./onboarding/StepChips";
import { StepEvents } from "./onboarding/StepEvents";
import { StepGoals } from "./onboarding/StepGoals";
import { StepHello } from "./onboarding/StepHello";
import { StepKnown } from "./onboarding/StepKnown";
import { StepRank } from "./onboarding/StepRank";
import { StepReveal } from "./onboarding/StepReveal";
import { StepSlider } from "./onboarding/StepSlider";

const WHEN_OPTIONS: { label: string; months: number | null }[] = [
  { label: "Within a year", months: 12 },
  { label: "1-2 years", months: 18 },
  { label: "3-5 years", months: 48 },
  { label: "5+ years", months: 84 },
  { label: "Not sure yet", months: null },
];

const FUND_OPTIONS = [
  { label: "No loan", pct: 0 },
  { label: "Partly (about 30%)", pct: 30 },
  { label: "Mostly (about 60%)", pct: 60 },
  { label: "Almost all of it (90%)", pct: 90 },
];

function yearRange(): number[] {
  const current = new Date().getFullYear();
  return Array.from({ length: 16 }, (_, i) => current + i);
}

function statusClass(status: string): string {
  if (status === "unaffordable") return "text-error";
  if (status === "affordable") return "text-success";
  if (status === "tight") return "text-muted";
  return "text-muted";
}

function statusLabel(goal: GoalOut): string {
  if (!goal.plan) return "NEEDS INPUT";
  return (goal.affordability?.status ?? "unknown").toUpperCase();
}

function goalLine(goal: GoalOut): string {
  if (!goal.plan) return goal.plan_issue ?? "Amount and date not set yet.";
  const dateLabel = goal.target_date ? ml(isoDateToMonthIndex(goal.target_date)) : null;
  return dateLabel
    ? `${inr(goal.plan.monthly_needed)} a month to reach it by ${dateLabel}.`
    : `${inr(goal.plan.monthly_needed)} a month at this pace.`;
}

function goalTypeDef(goal: DraftGoal) {
  return goal.type === "custom" ? { ...CUSTOM_T, label: "Goal", kinds: undefined, q: undefined } : GT[goal.type as GoalTypeId];
}

export function JourneyOnboarding({ journey }: { journey: JourneyStateHook }) {
  const { state } = journey;
  if (!state) return null;

  const steps = journey.steps;
  const step = steps[state.onbStep] ?? steps[steps.length - 1];
  const progress = Math.round(((state.onbStep + 1) / steps.length) * 100);
  const goal = step.id ? state.draftGoals.find((g) => g.id === step.id) : undefined;
  const goalDef = goal ? goalTypeDef(goal) : undefined;

  let kicker = "MY JOURNEY";
  let title = "";
  let sub = "";
  let content: React.ReactNode = null;

  switch (step.k) {
    case "hello": {
      title = "Let's build your journey.";
      sub = "Tell me what's important to you. I'll help you understand what it could mean for your money.";
      content = <StepHello selectedId={state.character ?? DEFAULT_CHARACTER_ID} onSelect={journey.setCharacter} />;
      break;
    }
    case "stage": {
      kicker = "ABOUT YOU";
      title = "Where are you in your career right now?";
      sub = "This helps shape what's realistic for you — optional.";
      content = (
        <StepChips
          options={["Studying", "Early career", "Mid career", "Self-employed", "Between jobs", "Retired", "Rather not say"].map(
            (label) => ({ label, selected: state.profile.stage === label, onClick: () => journey.setStage(label) }),
          )}
        />
      );
      break;
    }
    case "income": {
      kicker = "ABOUT YOU";
      title = "What's your monthly in-hand income?";
      sub = "After tax — the amount that actually lands in your account.";
      const income = journey.financialProfile?.monthly_take_home ?? null;
      const known = state.profile.incomeSrc === "data" && income != null;
      content = known ? (
        <StepKnown
          value={inr(income) + "/month"}
          source="From your MoneyMitra income summary."
          onContinue={journey.next}
          onUpdate={journey.editIncome}
        />
      ) : (
        <StepSlider value={income} range={[10000, 1000000]} unit="a month" onChange={journey.setIncome} />
      );
      break;
    }
    case "saving": {
      kicker = "ABOUT YOU";
      title = "How much do you manage to save most months?";
      sub = "A rough monthly figure is fine.";
      const income = journey.financialProfile?.monthly_take_home ?? 0;
      const expenses = journey.financialProfile?.monthly_expenses;
      const saving = expenses != null ? Math.max(0, income - expenses) : null;
      const known = state.profile.savingSrc === "data" && saving != null;
      content = known ? (
        <StepKnown value={inr(saving) + "/month"} source="From your MoneyMitra activity." onContinue={journey.next} onUpdate={journey.editSaving} />
      ) : (
        <StepSlider value={saving} range={[1000, Math.max(50000, income || 100000)]} unit="a month" onChange={journey.setSaving} />
      );
      break;
    }
    case "goals": {
      kicker = "GOALS";
      title = "What's on your mind?";
      sub = "Pick anything that applies — you can add your own too.";
      const customs = state.draftGoals.filter((g) => g.type === "custom");
      content = (
        <StepGoals
          chips={GOAL_TYPES.map((gt) => ({
            label: gt.label,
            selected: state.draftGoals.some((g) => g.type === gt.t),
            onClick: () => journey.toggleGoal(gt.t),
          }))}
          customs={customs.map((g) => ({ id: g.id, title: g.title, onRemove: () => journey.removeDraftGoal(g.id) }))}
          onAddCustom={journey.addCustomGoal}
        />
      );
      break;
    }
    case "kind": {
      if (goal && goalDef?.kinds) {
        kicker = "GOAL · " + goalDef.title.toUpperCase();
        title = goalDef.q?.kind || "What kind are you thinking about?";
        content = (
          <StepCards
            cards={goalDef.kinds.map(([label, amount]) => ({
              label,
              onClick: () => journey.setKind(goal.id, amount),
            }))}
          />
        );
      }
      break;
    }
    case "when": {
      if (goal) {
        kicker = goalDef ? "GOAL · " + goalDef.title.toUpperCase() : "GOAL";
        title = goalDef?.q?.when || "When are you thinking of this?";
        const now = nowIndex();
        content = (
          <StepChips
            options={WHEN_OPTIONS.map((opt) => ({
              label: opt.label,
              selected: opt.months == null ? goal.date == null : goal.date === now + opt.months,
              onClick: () => journey.setWhen(goal.id, opt.months == null ? null : now + opt.months),
            }))}
          />
        );
      }
      break;
    }
    case "amount": {
      if (goal && goalDef) {
        kicker = "GOAL · " + goalDef.title.toUpperCase();
        title = goalDef.q?.amount || "Roughly how much will this cost?";
        const value = goal.amount ?? null;
        const savedMax = Math.max(10000, Math.round((value ?? goalDef.def) / 1000) * 1000);
        content = (
          <StepSlider
            value={value}
            range={goalDef.range}
            onChange={(v) => journey.setAmount(goal.id, v)}
            chips={[{ label: "Use " + cmp(goalDef.def), onClick: () => journey.setAmount(goal.id, goalDef.def) }]}
            saved={{
              value: goal.saved ?? 0,
              max: savedMax,
              step: savedMax < 100000 ? 1000 : 10000,
              onChange: (v) => journey.setSaved(goal.id, v),
            }}
          />
        );
      }
      break;
    }
    case "fund": {
      if (goal) {
        kicker = goalDef ? "GOAL · " + goalDef.title.toUpperCase() : "GOAL";
        title = "Will any of this be funded by a loan?";
        const typeKey = goal.type;
        const allowed = LOAN_OK[typeKey] ? FUND_OPTIONS : [FUND_OPTIONS[0]];
        content = <StepCards cards={allowed.map((o) => ({ label: o.label, onClick: () => journey.setFund(goal.id, o.pct) }))} />;
      }
      break;
    }
    case "rank": {
      kicker = "PRIORITIES";
      title = "Which matters most right now?";
      sub = "Drag to reorder, or use the arrows.";
      const active = journey.goals.filter((g) => g.status === "active");
      content = (
        <StepRank
          rows={active.map((g) => ({ id: g.id, title: g.title, sub: g.cost_today != null ? cmp(g.cost_today) : undefined }))}
          onReorder={(ids) => journey.reorderGoals(ids)}
        />
      );
      break;
    }
    case "events": {
      kicker = "WHAT ELSE IS COMING";
      title = "Anything else on the horizon?";
      sub = "Optional — things like a new job or a move.";
      const eventItems = state.items.filter((i) => i.kind === "event");
      content = (
        <StepEvents
          chips={EVENT_TYPES.map((label) => ({
            label,
            selected: eventItems.some((e) => e.title === label),
            onClick: () => journey.toggleEvent(label),
          }))}
          rows={eventItems.map((e) => ({
            id: e.id,
            title: e.title,
            year: Math.floor((e.date ?? nowIndex()) / 12),
            yearOptions: yearRange(),
            onYearChange: (y) => journey.setEventYear(e.id, y),
          }))}
        />
      );
      break;
    }
    case "reveal": {
      kicker = "YOUR JOURNEY";
      title = "Here's your journey so far.";
      sub = "You can change any of this any time.";
      const active = journey.goals.filter((g) => g.status === "active");
      const lines = active.map((g) => ({
        id: g.id,
        title: g.title,
        line: goalLine(g),
        status: statusLabel(g),
        statusClassName: statusClass(g.affordability?.status ?? "unknown"),
      }));
      const top = active[0];
      const rec = top ? affordabilitySuggestion(top) : undefined;
      content = <StepReveal lines={lines} rec={rec} />;
      break;
    }
  }

  const isReveal = step.k === "reveal";

  return (
    <div className="flex flex-col gap-6 rounded-3xl border border-line bg-card p-8 shadow-sm">
      <div className="flex flex-wrap items-center gap-4">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">My journey · Building</p>
        <div className="h-1 min-w-[120px] flex-1 overflow-hidden rounded-full bg-field">
          <div className="h-full bg-[#3155E0] transition-[width] duration-300 dark:bg-[#7B9AFF]" style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={journey.skipOnb} className="text-sm font-medium text-muted hover:text-foreground">
          Skip for now
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-[#3155E0] dark:text-[#7B9AFF]">{kicker}</p>
        <h2 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h2>
        {sub && <p className="max-w-xl text-base text-muted">{sub}</p>}
      </div>

      {content}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="secondary"
          size="md"
          className="rounded-full"
          onClick={journey.back}
          style={{ visibility: state.onbStep > 0 ? "visible" : "hidden" }}
        >
          Back
        </Button>
        <div className="flex-1" />
        <p className="font-mono text-xs text-muted">
          {state.onbStep + 1} of {steps.length}
        </p>
        <Button variant="primary" size="md" className="rounded-full" onClick={journey.next}>
          {isReveal ? "Enter My Journey" : "Continue"}
        </Button>
      </div>
    </div>
  );
}

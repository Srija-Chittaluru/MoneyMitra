import { useCallback, useMemo, useSyncExternalStore } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import type { CharacterId } from "./characters";
import { GT, type GoalTypeId } from "./goalTypes";
import { freshJourneyState, type DraftGoal, type JourneyItem, type JourneyState, type NonGoalKind } from "./state";
import { useFinancialProfile } from "./useFinancialProfile";
import { useGoals } from "./useGoals";
import { buildSteps, isDraftGoalLastQuestion, monthIndexToIsoDate, parseDesc, uid } from "./wizardLogic";

function storageKey(userId: string) {
  return `moneymitra:journey:state:${userId}`;
}

/**
 * Normalizes whatever's in localStorage into the current `JourneyState` shape.
 * Older sessions (before goals moved to the backend) stored goals inline in
 * `items` with `kind: "goal"` and had no `draftGoals` at all — reading that
 * shape as-is leaves `draftGoals` undefined and crashes `buildSteps`.
 */
function normalizeState(raw: unknown): JourneyState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<JourneyState> & { items?: unknown[] };
  const items = Array.isArray(r.items)
    ? r.items.filter(
        (i): i is JourneyItem => !!i && typeof i === "object" && (i as { kind?: unknown }).kind !== "goal",
      )
    : [];
  return {
    character: r.character ?? "biker",
    profile: r.profile ?? {},
    items,
    draftGoals: Array.isArray(r.draftGoals) ? (r.draftGoals as DraftGoal[]) : [],
    onbActive: r.onbActive ?? false,
    onbStep: typeof r.onbStep === "number" ? r.onbStep : 0,
    built: r.built ?? false,
  };
}

function parseState(raw: string | null): JourneyState | null {
  if (!raw) return null;
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return null;
  }
}

// useSyncExternalStore needs a referentially stable snapshot when nothing
// changed, so re-parsed JSON is cached by its raw string rather than
// returned fresh (and therefore "changed") on every call.
let cache: { key: string; raw: string | null; value: JourneyState | null } | null = null;

function readState(userId: string): JourneyState | null {
  const key = storageKey(userId);
  const raw = window.localStorage.getItem(key);
  if (cache && cache.key === key && cache.raw === raw) return cache.value;
  const value = parseState(raw);
  cache = { key, raw, value };
  return value;
}

function writeState(userId: string, state: JourneyState) {
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((l) => l());
}
function subscribe(callback: () => void) {
  listeners.add(callback);
  window.addEventListener("storage", callback);
  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", callback);
  };
}
function getServerSnapshot(): JourneyState | null {
  return null;
}

export type JourneyPhase = "empty" | "onboarding" | "main";

export function journeyPhase(state: JourneyState | null): JourneyPhase {
  if (!state) return "empty";
  return state.onbActive ? "onboarding" : "main";
}

/**
 * The user's own journey: character, profile, draft/real goals, events, and
 * where they are in onboarding. Goals themselves are backend-persisted (see
 * `useGoals`); everything else here is localStorage only — there's no
 * backend schema for character/events/onboarding-progress.
 */
export function useJourneyState() {
  const { user } = useAuth();
  const userId = user?.id;
  const goalsApi = useGoals();
  const financialProfile = useFinancialProfile();

  const getSnapshot = useCallback(() => {
    if (!userId) return null;
    return readState(userId);
  }, [userId]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const upd = useCallback(
    (mutator: (draft: JourneyState) => void) => {
      if (!userId) return;
      const current = readState(userId);
      if (!current) return;
      const draft = structuredClone(current);
      mutator(draft);
      writeState(userId, draft);
      notify();
    },
    [userId],
  );

  const startJourney = useCallback(
    (seed?: { income?: number }) => {
      if (!userId) return;
      const fresh = freshJourneyState();
      if (seed?.income != null) {
        fresh.profile.incomeSrc = "data";
        financialProfile.updateProfile({ monthly_take_home: seed.income, monthly_expenses: null }).catch(() => {});
      }
      writeState(userId, fresh);
      notify();
    },
    [userId, financialProfile],
  );

  const later = useCallback(
    (seed?: { income?: number }) => {
      if (!userId) return;
      const fresh = freshJourneyState();
      fresh.onbActive = false;
      fresh.built = true;
      if (seed?.income != null) {
        fresh.profile.incomeSrc = "data";
        financialProfile.updateProfile({ monthly_take_home: seed.income, monthly_expenses: null }).catch(() => {});
      }
      writeState(userId, fresh);
      notify();
    },
    [userId, financialProfile],
  );

  const endOnboarding = useCallback(
    () =>
      upd((draft) => {
        draft.draftGoals = [];
        draft.built = true;
        draft.onbActive = false;
        draft.onbStep = 0;
      }),
    [upd],
  );

  const finish = endOnboarding;
  const skipOnb = endOnboarding;

  const activeGoalCount = goalsApi.goals.filter((g) => g.status === "active").length;
  const steps = useMemo(
    () => (state ? buildSteps(state.draftGoals, activeGoalCount) : []),
    [state, activeGoalCount],
  );

  const next = useCallback(async () => {
    if (!state) return;
    const current = steps[state.onbStep];
    if (!current) return;
    if (current.k === "reveal") {
      endOnboarding();
      return;
    }
    let completedGoalId: string | null = null;
    if (current.id) {
      const goal = state.draftGoals.find((g) => g.id === current.id);
      if (goal && isDraftGoalLastQuestion(current, goal)) {
        // This draft's last question is answered — create it for real and drop the local draft.
        try {
          await goalsApi.createGoal({
            title: goal.title,
            goal_type: goal.type,
            target_date: goal.date != null ? monthIndexToIsoDate(goal.date) : null,
            cost_today: goal.amount ?? null,
            existing_savings: goal.saved ?? 0,
            loan_pct: goal.loanPct ?? 0,
          });
        } catch {
          // Leave the draft in place so the user can retry rather than losing it silently.
          return;
        }
        completedGoalId = goal.id;
      }
    }
    // The step the user should land on next, identified by (kind, goal id) rather than
    // raw index — completing a goal shrinks the rebuilt step array (its own questions
    // drop out), so a plain "+1" would land on the wrong step once the array resizes.
    const nextStepTemplate = steps[state.onbStep + 1] ?? null;
    upd((draft) => {
      if (completedGoalId) {
        draft.draftGoals = draft.draftGoals.filter((g) => g.id !== completedGoalId);
      }
      const newSteps = buildSteps(draft.draftGoals, goalsApi.goals.filter((g) => g.status === "active").length);
      let newIndex = nextStepTemplate
        ? newSteps.findIndex((s) => s.k === nextStepTemplate.k && s.id === nextStepTemplate.id)
        : -1;
      if (newIndex < 0) newIndex = Math.min(draft.onbStep + 1, newSteps.length - 1);
      draft.onbStep = newIndex;
    });
  }, [state, steps, upd, goalsApi, endOnboarding]);

  const back = useCallback(
    () =>
      upd((draft) => {
        draft.onbStep = Math.max(0, draft.onbStep - 1);
      }),
    [upd],
  );

  const setCharacter = useCallback(
    (character: CharacterId) =>
      upd((draft) => {
        draft.character = character;
      }),
    [upd],
  );

  const setStage = useCallback(
    (stage: string) =>
      upd((draft) => {
        draft.profile.stage = stage;
      }),
    [upd],
  );

  const setIncome = useCallback(
    (income: number) => {
      upd((draft) => {
        draft.profile.incomeSrc = "user";
      });
      return financialProfile.updateProfile({
        monthly_take_home: income,
        monthly_expenses: financialProfile.profile?.monthly_expenses ?? null,
      });
    },
    [upd, financialProfile],
  );

  // The wizard asks "how much do you save", but the backend's affordability
  // math wants expenses — derived from income minus the saving figure.
  const setSaving = useCallback(
    (saving: number) => {
      upd((draft) => {
        draft.profile.savingSrc = "user";
      });
      const income = financialProfile.profile?.monthly_take_home ?? 0;
      return financialProfile.updateProfile({
        monthly_take_home: income,
        monthly_expenses: Math.max(0, income - saving),
      });
    },
    [upd, financialProfile],
  );

  const editIncome = useCallback(
    () =>
      upd((draft) => {
        draft.profile.incomeSrc = "user";
      }),
    [upd],
  );

  const editSaving = useCallback(
    () =>
      upd((draft) => {
        draft.profile.savingSrc = "user";
      }),
    [upd],
  );

  const toggleGoal = useCallback(
    (type: GoalTypeId) =>
      upd((draft) => {
        const existing = draft.draftGoals.find((g) => g.type === type);
        if (existing) {
          draft.draftGoals = draft.draftGoals.filter((g) => g.id !== existing.id);
          return;
        }
        const goal: DraftGoal = { id: uid(), type, title: GT[type].title };
        draft.draftGoals.push(goal);
      }),
    [upd],
  );

  const addCustomGoal = useCallback(
    (text: string) =>
      upd((draft) => {
        const parsed = parseDesc(text);
        const goal: DraftGoal = {
          id: uid(),
          type: "custom",
          title: parsed.title || text,
          amount: parsed.amount,
          date: parsed.date ?? null,
        };
        draft.draftGoals.push(goal);
      }),
    [upd],
  );

  const removeDraftGoal = useCallback(
    (id: string) =>
      upd((draft) => {
        draft.draftGoals = draft.draftGoals.filter((g) => g.id !== id);
      }),
    [upd],
  );

  const setKind = useCallback(
    (goalId: string, kindAmount: number | null) =>
      upd((draft) => {
        const goal = draft.draftGoals.find((g) => g.id === goalId);
        if (goal && kindAmount != null) goal.amount = kindAmount;
      }),
    [upd],
  );

  const setWhen = useCallback(
    (goalId: string, date: number | null) =>
      upd((draft) => {
        const goal = draft.draftGoals.find((g) => g.id === goalId);
        if (goal) goal.date = date;
      }),
    [upd],
  );

  const setAmount = useCallback(
    (goalId: string, amount: number) =>
      upd((draft) => {
        const goal = draft.draftGoals.find((g) => g.id === goalId);
        if (goal) goal.amount = amount;
      }),
    [upd],
  );

  const setSaved = useCallback(
    (goalId: string, saved: number) =>
      upd((draft) => {
        const goal = draft.draftGoals.find((g) => g.id === goalId);
        if (goal) goal.saved = saved;
      }),
    [upd],
  );

  const setFund = useCallback(
    (goalId: string, loanPct: number) =>
      upd((draft) => {
        const goal = draft.draftGoals.find((g) => g.id === goalId);
        if (goal) goal.loanPct = loanPct;
      }),
    [upd],
  );

  const toggleEvent = useCallback(
    (title: string) =>
      upd((draft) => {
        const existing = draft.items.find((i) => i.kind === "event" && i.title === title);
        if (existing) {
          draft.items = draft.items.filter((i) => i.id !== existing.id);
          return;
        }
        const nextYear = new Date().getFullYear() + 1;
        const event: JourneyItem = {
          id: "e-" + uid(),
          kind: "event",
          title,
          date: nextYear * 12 + 5,
          source: "user",
        };
        draft.items.push(event);
      }),
    [upd],
  );

  const setEventYear = useCallback(
    (itemId: string, year: number) =>
      upd((draft) => {
        const item = draft.items.find((i) => i.id === itemId);
        if (item) item.date = year * 12 + 5;
      }),
    [upd],
  );

  const addItem = useCallback(
    (item: { kind: NonGoalKind; title: string; date?: number | null; note?: string }) =>
      upd((draft) => {
        draft.items.push({ ...item, id: uid(), source: "user" });
      }),
    [upd],
  );

  const removeItem = useCallback(
    (id: string) =>
      upd((draft) => {
        draft.items = draft.items.filter((i) => i.id !== id);
      }),
    [upd],
  );

  return {
    state,
    phase: journeyPhase(state),
    steps,
    nowStep: state?.onbStep ?? 0,
    goals: goalsApi.goals,
    goalsLoading: goalsApi.isLoading,
    financialProfile: financialProfile.profile,
    startJourney,
    later,
    skipOnb,
    next,
    back,
    finish,
    setCharacter,
    setStage,
    setIncome,
    setSaving,
    editIncome,
    editSaving,
    toggleGoal,
    addCustomGoal,
    removeDraftGoal,
    setKind,
    setWhen,
    setAmount,
    setSaved,
    setFund,
    toggleEvent,
    setEventYear,
    createGoal: goalsApi.createGoal,
    updateGoal: goalsApi.updateGoal,
    archiveGoal: goalsApi.archiveGoal,
    completeGoal: goalsApi.completeGoal,
    reopenGoal: goalsApi.reopenGoal,
    deleteGoal: goalsApi.deleteGoal,
    reorderGoals: goalsApi.reorderGoals,
    updateFinancialProfile: financialProfile.updateProfile,
    addItem,
    removeItem,
  };
}

export type JourneyStateHook = ReturnType<typeof useJourneyState>;

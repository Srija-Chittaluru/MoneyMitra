import type { CharacterId } from "./characters";
import type { GoalTypeId } from "./goalTypes";
import type { GoalKind } from "./goals";

export type DataSource = "data" | "user";

/** Non-goal journey entries — goals themselves now live on the backend (see `useGoals`). */
export type NonGoalKind = Exclude<GoalKind, "goal">;

export interface JourneyItem {
  id: string;
  kind: NonGoalKind;
  title: string;
  /** Month-index (year*12+month), matching `nowIndex()`. null/undefined = undated. */
  date?: number | null;
  note?: string;
  source: DataSource;
}

/**
 * A goal still being built in the wizard (kind → when → amount → fund), not
 * yet POSTed to the backend. Once its last required question is answered it's
 * created via `useGoals().createGoal` and dropped from this list — from then
 * on the backend's `GoalOut` is the only copy that exists.
 */
export interface DraftGoal {
  id: string;
  type: GoalTypeId | "custom";
  title: string;
  date?: number | null;
  amount?: number;
  saved?: number;
  loanPct?: number;
}

export interface JourneyProfile {
  stage?: string | null;
  /** Whether income/saving are still the value MoneyMitra already knew, or the user has edited them.
   * The numbers themselves live on the backend (`useFinancialProfile`) — this is local UX state only. */
  incomeSrc?: DataSource;
  savingSrc?: DataSource;
}

export interface JourneyState {
  character: CharacterId;
  profile: JourneyProfile;
  items: JourneyItem[];
  draftGoals: DraftGoal[];
  onbActive: boolean;
  onbStep: number;
  built: boolean;
}

export function freshJourneyState(character: CharacterId = "biker"): JourneyState {
  return {
    character,
    profile: {},
    items: [],
    draftGoals: [],
    onbActive: true,
    onbStep: 0,
    built: false,
  };
}

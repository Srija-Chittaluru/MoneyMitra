import type { QueryClient } from "@tanstack/react-query";
import type { Goal } from "./types";

/**
 * Every goal query sits under "goals". A goal's affordability depends on every
 * other goal's monthly amount and on the financial profile, so any change
 * invalidates the whole family rather than guessing which figures moved.
 */
export const goalKeys = {
  all: ["goals"] as const,
  list: (includeArchived: boolean) => ["goals", "list", { includeArchived }] as const,
  detail: (id: string) => ["goals", "detail", id] as const,
  contributions: (id: string) => ["goals", "contributions", id] as const,
  financialProfile: ["goals", "financial-profile"] as const,
};

/**
 * The active goal due soonest: completed and archived goals never count. Ties
 * keep the API's order (target date, then creation).
 */
export function nextMilestone(goals: readonly Goal[]): Goal | null {
  let next: Goal | null = null;
  for (const goal of goals) {
    if (goal.status !== "active") continue;
    if (next === null || goal.target_date < next.target_date) next = goal;
  }
  return next;
}

export function refreshGoals(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: goalKeys.all });
}

import { apiFetch } from "@/lib/api-client";
import type { Contribution, ContributionInput, FinancialProfile, Goal, GoalInput } from "./types";

const GOALS = "/api/v1/goals";

export function listGoals(includeArchived: boolean) {
  return apiFetch<Goal[]>(`${GOALS}?include_archived=${includeArchived}`);
}

export function getGoal(id: string) {
  return apiFetch<Goal>(`${GOALS}/${id}`);
}

export function createGoal(input: GoalInput) {
  return apiFetch<Goal>(GOALS, { method: "POST", body: JSON.stringify(input) });
}

export function updateGoal(id: string, input: GoalInput) {
  return apiFetch<Goal>(`${GOALS}/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export type GoalAction = "complete" | "reopen" | "archive";

export function changeGoalStatus(id: string, action: GoalAction) {
  return apiFetch<Goal>(`${GOALS}/${id}/${action}`, { method: "POST" });
}

export function deleteGoal(id: string) {
  return apiFetch<void>(`${GOALS}/${id}`, { method: "DELETE" });
}

export function listContributions(goalId: string) {
  return apiFetch<Contribution[]>(`${GOALS}/${goalId}/contributions`);
}

export function addContribution(goalId: string, input: ContributionInput) {
  return apiFetch<Contribution>(`${GOALS}/${goalId}/contributions`, { method: "POST", body: JSON.stringify(input) });
}

export function updateContribution(goalId: string, id: string, input: ContributionInput) {
  return apiFetch<Contribution>(`${GOALS}/${goalId}/contributions/${id}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteContribution(goalId: string, id: string) {
  return apiFetch<void>(`${GOALS}/${goalId}/contributions/${id}`, { method: "DELETE" });
}

export function getFinancialProfile() {
  return apiFetch<FinancialProfile>("/api/v1/users/me/financial-profile");
}

/** The API replaces both figures at once, so both are always sent; null clears one. */
export function saveFinancialProfile(profile: FinancialProfile) {
  const body: FinancialProfile = {
    monthly_take_home: profile.monthly_take_home,
    monthly_expenses: profile.monthly_expenses,
  };
  return apiFetch<FinancialProfile>("/api/v1/users/me/financial-profile", {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

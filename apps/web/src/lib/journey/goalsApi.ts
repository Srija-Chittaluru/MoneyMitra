import { apiFetch } from "@/lib/api-client";
import type { ContributionIn, ContributionOut, GoalIn, GoalOut } from "./goalsTypes";

export function listGoals(includeArchived = false) {
  return apiFetch<GoalOut[]>(`/api/v1/goals${includeArchived ? "?include_archived=true" : ""}`);
}

export function createGoal(input: GoalIn) {
  return apiFetch<GoalOut>("/api/v1/goals", { method: "POST", body: JSON.stringify(input) });
}

export function updateGoal(id: string, input: GoalIn) {
  return apiFetch<GoalOut>(`/api/v1/goals/${id}`, { method: "PUT", body: JSON.stringify(input) });
}

export function archiveGoal(id: string) {
  return apiFetch<GoalOut>(`/api/v1/goals/${id}/archive`, { method: "POST" });
}

export function completeGoal(id: string) {
  return apiFetch<GoalOut>(`/api/v1/goals/${id}/complete`, { method: "POST" });
}

export function reopenGoal(id: string) {
  return apiFetch<GoalOut>(`/api/v1/goals/${id}/reopen`, { method: "POST" });
}

export function deleteGoal(id: string) {
  return apiFetch<void>(`/api/v1/goals/${id}`, { method: "DELETE" });
}

export function reorderGoals(goalIds: string[]) {
  return apiFetch<GoalOut[]>("/api/v1/goals/reorder", {
    method: "POST",
    body: JSON.stringify({ goal_ids: goalIds }),
  });
}

export function listContributions(goalId: string) {
  return apiFetch<ContributionOut[]>(`/api/v1/goals/${goalId}/contributions`);
}

export function addContribution(goalId: string, input: ContributionIn) {
  return apiFetch<ContributionOut>(`/api/v1/goals/${goalId}/contributions`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function updateContribution(goalId: string, contributionId: string, input: ContributionIn) {
  return apiFetch<ContributionOut>(`/api/v1/goals/${goalId}/contributions/${contributionId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function deleteContribution(goalId: string, contributionId: string) {
  return apiFetch<void>(`/api/v1/goals/${goalId}/contributions/${contributionId}`, { method: "DELETE" });
}

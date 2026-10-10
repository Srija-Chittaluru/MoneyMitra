import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addContribution,
  archiveGoal,
  completeGoal,
  createGoal,
  deleteContribution,
  deleteGoal,
  listContributions,
  listGoals,
  reopenGoal,
  reorderGoals,
  updateContribution,
  updateGoal,
} from "./goalsApi";
import type { ApiError } from "@/lib/api-client";
import type { ContributionIn, ContributionOut, GoalIn, GoalOut } from "./goalsTypes";

export const JOURNEY_GOALS_QUERY_KEY = ["journey-goals"] as const;
export const contributionsQueryKey = (goalId: string) => ["journey-goal-contributions", goalId] as const;

/**
 * The user's real, backend-persisted goals — the source of truth for /journey's milestones.
 * Always fetched including archived ones (completed goals are included by the backend either
 * way) so there's one cache to keep in sync; callers filter by `status` for active-only views.
 */
export function useGoals() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: JOURNEY_GOALS_QUERY_KEY, queryFn: () => listGoals(true) });

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: JOURNEY_GOALS_QUERY_KEY });
  }

  const create = useMutation<GoalOut, ApiError, GoalIn>({
    mutationFn: createGoal,
    onSuccess: invalidate,
  });

  const update = useMutation<GoalOut, ApiError, { id: string; input: GoalIn }>({
    mutationFn: ({ id, input }) => updateGoal(id, input),
    onSuccess: invalidate,
  });

  const archive = useMutation<GoalOut, ApiError, string>({
    mutationFn: archiveGoal,
    onSuccess: invalidate,
  });

  const complete = useMutation<GoalOut, ApiError, string>({
    mutationFn: completeGoal,
    onSuccess: invalidate,
  });

  const reopen = useMutation<GoalOut, ApiError, string>({
    mutationFn: reopenGoal,
    onSuccess: invalidate,
  });

  const remove = useMutation<void, ApiError, string>({
    mutationFn: deleteGoal,
    onSuccess: invalidate,
  });

  const reorder = useMutation<GoalOut[], ApiError, string[]>({
    mutationFn: reorderGoals,
    onSuccess: (goals) => queryClient.setQueryData(JOURNEY_GOALS_QUERY_KEY, goals),
  });

  return {
    goals: query.data ?? [],
    isLoading: query.isPending,
    isError: query.isError,
    createGoal: create.mutateAsync,
    updateGoal: (id: string, input: GoalIn) => update.mutateAsync({ id, input }),
    archiveGoal: archive.mutateAsync,
    completeGoal: complete.mutateAsync,
    reopenGoal: reopen.mutateAsync,
    deleteGoal: remove.mutateAsync,
    reorderGoals: reorder.mutateAsync,
  };
}

/** A single goal's logged contributions — kept separate since most views never need them. */
export function useContributions(goalId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: contributionsQueryKey(goalId ?? ""),
    queryFn: () => listContributions(goalId!),
    enabled: goalId != null,
  });

  // A contribution changes the goal's `current_funding`/`contributions_total` and therefore
  // its plan and affordability too, so both caches need to refresh together.
  function invalidate() {
    return Promise.all([
      queryClient.invalidateQueries({ queryKey: contributionsQueryKey(goalId ?? "") }),
      queryClient.invalidateQueries({ queryKey: JOURNEY_GOALS_QUERY_KEY }),
    ]);
  }

  const add = useMutation<ContributionOut, ApiError, ContributionIn>({
    mutationFn: (input) => addContribution(goalId!, input),
    onSuccess: invalidate,
  });

  const update = useMutation<ContributionOut, ApiError, { id: string; input: ContributionIn }>({
    mutationFn: ({ id, input }) => updateContribution(goalId!, id, input),
    onSuccess: invalidate,
  });

  const remove = useMutation<void, ApiError, string>({
    mutationFn: (id) => deleteContribution(goalId!, id),
    onSuccess: invalidate,
  });

  return {
    contributions: query.data ?? [],
    isLoading: query.isPending,
    addContribution: add.mutateAsync,
    updateContribution: (id: string, input: ContributionIn) => update.mutateAsync({ id, input }),
    deleteContribution: remove.mutateAsync,
  };
}

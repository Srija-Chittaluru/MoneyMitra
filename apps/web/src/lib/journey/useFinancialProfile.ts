import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getFinancialProfile, updateFinancialProfile } from "./financialProfileApi";
import { JOURNEY_GOALS_QUERY_KEY } from "./useGoals";
import type { ApiError } from "@/lib/api-client";
import type { FinancialProfile } from "./goalsTypes";

export const FINANCIAL_PROFILE_QUERY_KEY = ["journey-financial-profile"] as const;

/** The user's real monthly take-home/expenses — backs goal affordability. */
export function useFinancialProfile() {
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: FINANCIAL_PROFILE_QUERY_KEY, queryFn: getFinancialProfile });

  const update = useMutation<FinancialProfile, ApiError, FinancialProfile>({
    mutationFn: updateFinancialProfile,
    onSuccess: (profile) => {
      queryClient.setQueryData(FINANCIAL_PROFILE_QUERY_KEY, profile);
      // Every goal's `affordability` is computed server-side from this profile, so a
      // changed profile makes every already-fetched goal's affordability stale.
      queryClient.invalidateQueries({ queryKey: JOURNEY_GOALS_QUERY_KEY });
    },
  });

  return {
    profile: query.data,
    isLoading: query.isPending,
    updateProfile: update.mutateAsync,
  };
}

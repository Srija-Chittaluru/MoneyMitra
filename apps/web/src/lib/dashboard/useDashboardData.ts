import { useQuery } from "@tanstack/react-query";
import { listDocuments } from "@/lib/documents/api";
import { getRecommendations } from "@/lib/recommendations/api";
import { getDashboardSummary } from "./api";

/**
 * The three real sources behind the dashboard. Each section renders from its
 * own query, so one slow or failing request never blanks the whole page.
 */
export function useDashboardData() {
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const documents = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const recommendations = useQuery({ queryKey: ["dashboard-recommendations"], queryFn: () => getRecommendations() });
  return { summary, documents, recommendations };
}

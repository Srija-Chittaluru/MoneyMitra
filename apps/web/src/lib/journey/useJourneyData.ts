import { useQuery } from "@tanstack/react-query";
import { getDashboardSummary } from "@/lib/dashboard/api";
import { listDocuments } from "@/lib/documents/api";
import { getRecommendations } from "@/lib/recommendations/api";

/**
 * The real sources behind the journey timeline. Reuses the same query keys as
 * the dashboard page where possible, so the cache is shared instead of
 * duplicated. Each section is its own query, so one slow/failing request
 * never blanks the whole page.
 */
export function useJourneyData() {
  const summary = useQuery({ queryKey: ["dashboard-summary"], queryFn: getDashboardSummary });
  const documents = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const recommendations = useQuery({ queryKey: ["dashboard-recommendations"], queryFn: () => getRecommendations() });
  return { summary, documents, recommendations };
}

import { AppShell } from "@/components/shell/AppShell";
import { RecommendationsView } from "@/components/recommendations/RecommendationsView";

export default function RecommendationsPage() {
  return (
    <AppShell title="Recommendations">
      <RecommendationsView />
    </AppShell>
  );
}

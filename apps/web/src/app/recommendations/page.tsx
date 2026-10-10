import { AppShell } from "@/components/shell/AppShell";
import { ProductCategories } from "@/components/recommendations/ProductCategories";

export default function RecommendationsPage() {
  return (
    <AppShell title="Recommendations">
      <ProductCategories />
    </AppShell>
  );
}

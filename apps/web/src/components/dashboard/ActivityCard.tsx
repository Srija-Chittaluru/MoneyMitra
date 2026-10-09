import { FileText, History, Scale } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { ActivityItem } from "@/lib/dashboard/state";
import { EmptyPanel } from "./EmptyPanel";
import { SectionError, SectionSkeleton } from "./SectionStatus";

interface ActivityCardProps {
  status: "loading" | "error" | "ready";
  items: ActivityItem[];
  onRetry: () => void;
  className?: string;
}

/** Same row layout as the design system's transaction row, for things the user actually did. */
function ActivityRow({ item }: { item: ActivityItem }) {
  const Icon = item.kind === "tax" ? Scale : FileText;
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-field text-foreground">
        <Icon className="h-5 w-5" strokeWidth={1.75} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{item.title}</p>
        <p className="truncate text-sm text-muted">{item.subtitle}</p>
      </div>
    </div>
  );
}

export function ActivityCard({ status, items, onRetry, className }: ActivityCardProps) {
  return (
    <Card className={cn("border-line", className)}>
      <h3 className="text-h2 mb-2">Recent activity</h3>

      {status === "loading" ? (
        <SectionSkeleton />
      ) : status === "error" ? (
        <SectionError message="We couldn't load your activity." onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyPanel
          icon={History}
          title="No activity yet"
          description="Your financial activity will appear here as you add information to MoneyMitra."
        />
      ) : (
        <div className="divide-y divide-line">
          {items.map((item) => (
            <ActivityRow key={item.id} item={item} />
          ))}
        </div>
      )}
    </Card>
  );
}

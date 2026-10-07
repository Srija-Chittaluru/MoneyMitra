import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyPanelProps {
  icon: LucideIcon;
  title?: string;
  description: string;
  action?: ReactNode;
}

/** Compact version of the design system's empty state, sized to sit inside a dashboard card. */
export function EmptyPanel({ icon: Icon, title, description, action }: EmptyPanelProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-6 text-center">
      <Icon className="h-6 w-6 text-muted" strokeWidth={1.5} />
      {title && <p className="font-medium text-foreground">{title}</p>}
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

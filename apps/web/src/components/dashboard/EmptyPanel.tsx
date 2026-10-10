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
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-4 py-6 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10">
        <Icon className="h-5 w-5 text-accent-text" strokeWidth={1.75} />
      </span>
      {title && <p className="font-medium text-foreground">{title}</p>}
      <p className="max-w-sm text-sm text-muted">{description}</p>
      {action}
    </div>
  );
}

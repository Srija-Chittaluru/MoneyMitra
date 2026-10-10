import { cn } from "@/lib/cn";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Makes the whole box clickable, e.g. to open a file picker. */
  onClick?: () => void;
}

export function EmptyState({ icon: Icon, title, description, action, onClick }: EmptyStateProps) {
  const className = cn(
    "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border px-6 py-12 text-center",
    onClick && "w-full cursor-pointer transition-colors hover:border-accent hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
  );

  const content = (
    <>
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent/10">
        <Icon className="h-7 w-7 text-accent-text" strokeWidth={1.75} />
      </span>
      <p className="font-semibold text-foreground">{title}</p>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <div className={className}>{content}</div>;
}

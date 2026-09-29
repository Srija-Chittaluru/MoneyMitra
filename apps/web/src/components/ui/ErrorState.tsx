import { AlertTriangle } from "lucide-react";
import type { ReactNode } from "react";

interface ErrorStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function ErrorState({ title, description, action }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-error-bg bg-error-bg px-6 py-12 text-center">
      <AlertTriangle className="h-8 w-8 text-error" strokeWidth={1.5} />
      <p className="font-semibold text-error">{title}</p>
      {description && <p className="max-w-sm text-sm text-foreground">{description}</p>}
      {action}
    </div>
  );
}

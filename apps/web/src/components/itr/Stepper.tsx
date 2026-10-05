import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { STEPS } from "./options";

export function Stepper({ current, onSelect }: { current: number; onSelect: (step: number) => void }) {
  return (
    <nav aria-label="Filing steps" className="mb-6 overflow-x-auto">
      <ol className="flex min-w-max gap-2">
        {STEPS.map((step) => {
          const active = step.id === current;
          const done = step.id < current;
          return (
            <li key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  active ? "bg-primary text-primary-foreground" : "bg-surface-muted text-muted hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                    active ? "bg-surface text-foreground" : done ? "bg-success-bg text-success" : "bg-surface text-muted",
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : step.id}
                </span>
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

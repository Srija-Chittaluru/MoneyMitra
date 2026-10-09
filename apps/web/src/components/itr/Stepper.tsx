import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { STEPS } from "./options";

/** Pill steps joined by a line, like ClearTax's Personal Info → Income Sources → Tax Saving → Tax Summary. */
export function Stepper({
  current,
  onSelect,
  issueSteps,
}: {
  current: number;
  onSelect: (step: number) => void;
  issueSteps?: Set<number>;
}) {
  return (
    <nav aria-label="Filing steps" className="mb-6 overflow-x-auto pb-1">
      <ol className="flex min-w-max items-center">
        {STEPS.map((step, index) => {
          const active = step.id === current;
          const done = step.id < current && !issueSteps?.has(step.id);
          return (
            <li key={step.id} className="flex items-center">
              {index > 0 && <span aria-hidden className="h-px w-6 bg-line sm:w-10" />}
              <button
                type="button"
                onClick={() => onSelect(step.id)}
                aria-current={active ? "step" : undefined}
                className={cn(
                  "flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-line bg-card text-foreground hover:bg-hover",
                )}
              >
                {done && <Check className="h-4 w-4 text-success" />}
                {step.label}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

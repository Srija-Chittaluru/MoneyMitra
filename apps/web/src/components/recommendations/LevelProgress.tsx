import { Check } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { NextStep } from "@/lib/recommendations/types";

const STEPS = [
  { level: 1, label: "Profile", detail: "Age, job type, expected income" },
  { level: 2, label: "Your income", detail: "ITR filing or tax comparison" },
  { level: 3, label: "Your documents", detail: "Form 16, AIS, payslips" },
];

interface LevelProgressProps {
  level: number;
  nextStep: NextStep | null;
  onNextStep: (step: NextStep) => void;
}

export function LevelProgress({ level, nextStep, onNextStep }: LevelProgressProps) {
  return (
    <Card className="mb-6">
      <ol className="grid gap-4 sm:grid-cols-3">
        {STEPS.map((step) => {
          const done = level >= step.level;
          const current = level === step.level;
          return (
            <li key={step.level} className="flex items-start gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold",
                  done
                    ? "border-transparent bg-primary text-primary-foreground"
                    : "border-border text-muted",
                )}
              >
                {done ? <Check className="h-4 w-4" strokeWidth={2.5} /> : step.level}
              </span>
              <div>
                <p className={cn("text-sm font-semibold", done ? "text-foreground" : "text-muted")}>
                  Level {step.level}: {step.label}
                  {current && <span className="ml-2 text-xs font-medium text-link">You are here</span>}
                </p>
                <p className="text-sm text-muted">{step.detail}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {nextStep && (
        <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-foreground">{nextStep.title}</p>
            <p className="text-sm text-muted">{nextStep.description}</p>
          </div>
          <Button variant="primary" size="sm" className="shrink-0" onClick={() => onNextStep(nextStep)}>
            {nextStep.action_label}
          </Button>
        </div>
      )}
    </Card>
  );
}

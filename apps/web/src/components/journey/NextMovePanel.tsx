import Link from "next/link";
import { ArrowRight, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { cn } from "@/lib/cn";
import type { NextMove } from "@/lib/journey/build";
import type { GoalOut } from "@/lib/journey/goalsTypes";
import { affordabilityOptions, affordabilitySuggestion } from "@/lib/journey/wizardLogic";

/** A small alternating dot grid, echoing the "next move" marker from the original design. */
function DotMark() {
  return (
    <div className="grid grid-cols-3 gap-[3px]">
      {Array.from({ length: 9 }).map((_, i) => (
        <span
          key={i}
          className={cn("h-[3px] w-[3px] rounded-[1px]", i % 2 === 0 ? "bg-accent" : "bg-[#3155E0] dark:bg-[#7B9AFF]")}
        />
      ))}
    </div>
  );
}

function Panel({ headline, title, description, action }: { headline?: string; title: string; description: string; action?: { label: string; href: string } }) {
  return (
    <Card className="relative overflow-hidden bg-card border-line lg:h-[640px] lg:overflow-y-auto">
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-link/15 blur-3xl" />
      <div className="relative flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <DotMark />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Next move</p>
        </div>
        {headline && <p className="font-mono text-sm font-semibold text-accent-text">{headline}</p>}
      </div>
      <h2 className="relative mt-2 text-h1">{title}</h2>
      <p className="relative mt-2 text-sm text-foreground">{description}</p>
      {action && (
        <div className="relative mt-4">
          <Link href={action.href}>
            <Button variant="primary" size="sm" className="rounded-full">
              {action.label}
            </Button>
          </Link>
        </div>
      )}
    </Card>
  );
}

export function NextMovePanel({
  nextMove,
  selectedGoal,
}: {
  nextMove: NextMove;
  /** The goal behind whatever milestone is currently selected on the timeline — when set,
   * this panel is about THAT goal specifically, never a different, unrelated one. */
  selectedGoal?: GoalOut;
}) {
  if (selectedGoal) {
    const suggestion = affordabilitySuggestion(selectedGoal);
    const options = suggestion ? affordabilityOptions(selectedGoal) : [];
    const title = suggestion
      ? suggestion.what
      : selectedGoal.plan_issue
        ? "Add the missing details"
        : `${selectedGoal.title} is on track`;
    const description = suggestion
      ? [suggestion.why, suggestion.impact].filter(Boolean).join(" ")
      : (selectedGoal.plan_issue ?? selectedGoal.affordability?.reasons[0] ?? "No action needed here right now.");

    return (
      <Card className="relative overflow-hidden bg-card border-line lg:h-[640px] lg:overflow-y-auto">
        <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-link/15 blur-3xl" />
        <div className="relative flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <DotMark />
            <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Next move</p>
          </div>
          <p className="font-mono text-sm font-semibold text-accent-text">{selectedGoal.title}</p>
        </div>
        <h2 className="relative mt-2 text-h1">{title}</h2>
        <p className="relative mt-2 text-sm text-foreground">{description}</p>

        {options.length > 0 && (
          <div className="relative mt-4 flex flex-col gap-2">
            <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">Ways to make it fit</p>
            {options.map((o) => (
              <div key={o.key} className="rounded-xl border border-line bg-field p-3">
                <p className="text-sm font-semibold text-foreground">{o.label}</p>
                <p className="mt-0.5 text-sm text-muted">{o.detail}</p>
              </div>
            ))}
          </div>
        )}

        {selectedGoal.plan && (
          <div className="relative mt-6 flex justify-center">
            <Link href="/recommendations" className="group inline-flex">
              <Button
                variant="primary"
                size="md"
                className="gap-2 rounded-full px-6 shadow-lg shadow-primary/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/50 active:translate-y-0"
              >
                <TrendingUp className="h-4 w-4" strokeWidth={2.25} />
                Explore investment options
                <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
              </Button>
            </Link>
          </div>
        )}
      </Card>
    );
  }

  if (!nextMove) {
    return (
      <Card className="relative overflow-hidden bg-card border-line lg:h-[640px] lg:overflow-y-auto">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[#3155E0]/15 blur-3xl dark:bg-[#7B9AFF]/15"
        />
        <div className="relative flex items-center gap-2">
          <DotMark />
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">Next move</p>
        </div>
        <div className="relative mt-4">
          <EmptyPanel
            icon={Sparkles}
            title="You're all caught up"
            description="We'll surface your next move here as new recommendations come in."
          />
        </div>
      </Card>
    );
  }

  const title = nextMove.kind === "next_step" ? nextMove.step.title : nextMove.rec.title;
  const description = nextMove.kind === "next_step" ? nextMove.step.description : nextMove.rec.description;
  const actionLabel = nextMove.kind === "next_step" ? nextMove.step.action_label : nextMove.rec.action_label;
  // A next_step with no action_href means "fill in the profile card on the Recommendations page".
  const actionHref =
    nextMove.kind === "next_step" ? (nextMove.step.action_href ?? "/recommendations") : nextMove.rec.action_href;
  const headline =
    nextMove.kind === "recommendation" ? nextMove.rec.illustration?.lines.find((line) => line.emphasis) : undefined;

  return (
    <Panel
      headline={headline?.value}
      title={title}
      description={description}
      action={actionLabel && actionHref ? { label: actionLabel, href: actionHref } : undefined}
    />
  );
}

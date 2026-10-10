import { cn } from "@/lib/cn";
import type { FinancialProfile, GoalOut } from "@/lib/journey/goalsTypes";
import { inr } from "@/lib/journey/wizardLogic";

/**
 * Each goal's monthly need is computed independently (its own cost and
 * timeline, not a share of one pot) — this just totals them against what the
 * user says they can actually save, so that tension is visible rather than
 * computed invisibly by the backend and never shown anywhere.
 */
export function GoalsCommitmentSummary({
  goals,
  financialProfile,
}: {
  goals: GoalOut[];
  financialProfile?: FinancialProfile;
}) {
  const withPlan = goals.filter((g) => g.plan);
  if (withPlan.length === 0) return null;

  const totalNeeded = withPlan.reduce((sum, g) => sum + (g.plan?.monthly_needed ?? 0), 0);
  const capacity =
    financialProfile?.monthly_take_home != null && financialProfile?.monthly_expenses != null
      ? Math.max(0, financialProfile.monthly_take_home - financialProfile.monthly_expenses)
      : null;

  let indicator: "comfortable" | "tight" | "over" | "unknown" = "unknown";
  if (capacity != null) {
    if (totalNeeded <= capacity * 0.9) indicator = "comfortable";
    else if (totalNeeded <= capacity) indicator = "tight";
    else indicator = "over";
  }

  const indicatorText: Record<typeof indicator, string> = {
    comfortable: "Comfortably within your saving capacity",
    tight: "Close to your saving capacity",
    over: "More than you currently save",
    unknown: "Add your income to see if this fits",
  };
  const indicatorColor: Record<typeof indicator, string> = {
    comfortable: "text-success",
    tight: "text-muted",
    over: "text-error",
    unknown: "text-muted",
  };

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-line bg-card px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-foreground">
          <strong>{withPlan.length}</strong> {withPlan.length === 1 ? "goal needs" : "goals need"}{" "}
          <strong>{inr(totalNeeded)}</strong> a month combined
          {capacity != null && <> · you save {inr(capacity)} a month</>}
        </p>
        <span className={cn("ml-auto font-mono text-xs", indicatorColor[indicator])}>{indicatorText[indicator]}</span>
      </div>

      {withPlan.length > 1 && (
        <details>
          <summary className="cursor-pointer select-none text-xs font-medium text-muted hover:text-foreground">
            How does the split across goals work?
          </summary>
          <p className="mt-1.5 max-w-2xl text-xs text-muted">
            Each goal&apos;s monthly amount is worked out on its own — from its own cost, target date and an assumed
            growth rate — not as a share of one pot. A Master&apos;s in 2 years and a retirement in 30 years need very
            different monthly amounts even at the same final cost, purely from how much time each has to grow. When the
            goals together need more than you save, the lowest-priority goal (see &ldquo;Rank goals&rdquo;) is the one
            whose alternatives — a later date, a lower cost, or part-financing with a loan — get suggested first.
          </p>
        </details>
      )}
    </div>
  );
}

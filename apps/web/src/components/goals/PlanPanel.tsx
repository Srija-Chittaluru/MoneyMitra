import { Card } from "@/components/ui/Card";
import { formatRupees } from "@/lib/format";
import { formatPercent } from "@/lib/goals/form";
import type { GoalPlan } from "@/lib/goals/types";
import { RiskBadge } from "./GoalBadges";

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-md bg-surface-muted p-3">
      <p className="text-xs text-muted">{label}</p>
      <p className="mt-1 text-h2 text-foreground">{value}</p>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** The calculated plan, with the assumptions and disclosure exactly as the API states them. */
export function PlanPanel({ plan }: { plan: GoalPlan }) {
  return (
    <Card className="flex flex-col gap-5 border-line bg-card p-4 sm:p-6">
      <div>
        <h2 className="text-h2">The plan</h2>
        <p className="text-sm text-muted">Worked out from your goal&apos;s current figures every time you open it.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Estimated cost then"
          value={formatRupees(plan.future_cost)}
          hint={`After ${formatPercent(plan.inflation_rate, 0)} yearly price rises`}
        />
        <Stat label="Still to save" value={formatRupees(plan.remaining)} hint={`${formatRupees(plan.funding_counted)} saved`} />
        <Stat
          label="Needed each month"
          value={formatRupees(plan.monthly_needed)}
          hint={plan.monthly_needed === 0 ? "Fully funded" : "Rounded up to ₹100"}
        />
        <Stat label="Time to go" value={`${plan.months} ${plan.months === 1 ? "month" : "months"}`} />
      </div>

      <div className="rounded-md border border-line p-4">
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <p className="font-semibold text-foreground">Where the money could sit: {plan.approach.label.toLowerCase()}</p>
          <RiskBadge risk={plan.approach.risk} />
        </div>
        <p className="text-sm text-muted">{plan.approach.suggestion}.</p>
        <p className="mt-1 text-xs text-muted">
          Assumed return {formatPercent(plan.approach.annual_rate)} a year before tax. No specific product is
          recommended.
        </p>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">Assumptions</p>
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted marker:text-muted">
          {plan.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </div>

      <p className="rounded-md bg-warning-bg px-3 py-2 text-xs text-foreground">{plan.disclosure}</p>
    </Card>
  );
}

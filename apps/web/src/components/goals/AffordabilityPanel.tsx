import { CalendarClock, Landmark, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { formatMonthYear, formatPercent } from "@/lib/goals/form";
import { LOAN_GOAL_TYPES } from "@/lib/goals/types";
import type { Affordability, GoalPlan, GoalType, TakeHome } from "@/lib/goals/types";
import { AffordabilityBadge, RiskBadge } from "./GoalBadges";

const SOURCES: Record<string, string> = {
  itr_filing: "ITR filing",
  documents: "uploaded documents",
  tax_comparison: "tax comparison",
  profile: "expected income",
};

/** Where a usable take-home figure came from. When it isn't usable, the API's
 *  reasons already say why and what to add, so nothing is repeated here. */
function takeHomeSource(takeHome: TakeHome): string | null {
  if (takeHome.reliability === "confirmed") return "Using the take-home pay you entered.";
  if (takeHome.reliability !== "estimated") return null;
  const source = SOURCES[takeHome.source ?? ""] ?? "details";
  const year = takeHome.financial_year ? ` for FY ${takeHome.financial_year}` : "";
  return `Take-home estimated from your ${source}${year}. Your actual pay is likely to be lower.`;
}

function Row({ label, value, tag, strong }: { label: string; value: string; tag?: string; strong?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-4", strong && "rounded-md bg-surface-muted px-3 py-2")}>
      <dt className={cn("text-sm", strong ? "font-medium text-foreground" : "text-muted")}>
        {label}
        {tag && <span className="ml-2 rounded-full bg-warning-bg px-2 py-0.5 text-xs text-warning">{tag}</span>}
      </dt>
      <dd className={cn("font-mono text-sm text-foreground", strong && "font-semibold")}>{value}</dd>
    </div>
  );
}

function Alternative({ icon: Icon, title, children }: { icon: typeof Landmark; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-md border border-line p-4">
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">{title}</p>
        <div className="mt-1 flex flex-col gap-1 text-sm text-muted">{children}</div>
      </div>
    </div>
  );
}

interface AffordabilityPanelProps {
  affordability: Affordability;
  plan: GoalPlan;
  goalType: GoalType;
}

export function AffordabilityPanel({ affordability, plan, goalType }: AffordabilityPanelProps) {
  const { status, breakdown, later_date: later, lower_cost: lower } = affordability;
  const loan = LOAN_GOAL_TYPES.includes(goalType) ? affordability.loan : null;
  const source = takeHomeSource(affordability.take_home);
  const unknown = status === "unknown";
  const hasAlternatives = Boolean(later || lower || loan);

  return (
    <Card className="flex flex-col gap-5 border-line bg-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-h2">Does it fit your budget?</h2>
          {source && <p className="text-sm text-muted">{source}</p>}
        </div>
        <AffordabilityBadge status={status} />
      </div>

      {affordability.reasons.length > 0 && (
        <ul className="flex flex-col gap-1.5 text-sm text-foreground">
          {affordability.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}

      {breakdown && (
        <div className="rounded-md border border-line p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">
            {unknown ? "An indication only, not a verdict" : "How your month adds up"}
          </p>
          <dl className="flex flex-col gap-2">
            <Row
              label="Take-home pay"
              value={formatRupees(breakdown.take_home)}
              tag={affordability.take_home.reliability === "confirmed" ? undefined : "estimate"}
            />
            <Row
              label="Expenses"
              value={`− ${formatRupees(breakdown.expenses)}`}
              tag={breakdown.expenses_estimated ? "illustration" : undefined}
            />
            <Row label="Your other goals" value={`− ${formatRupees(breakdown.commitments)}`} />
            <Row label="Left each month" value={formatRupees(Math.max(0, breakdown.available))} strong />
            <Row label="Comfortable to commit (keeps a 10% cushion)" value={formatRupees(Math.max(0, breakdown.comfortable))} />
            <Row label="This goal needs" value={formatRupees(plan.monthly_needed)} strong />
          </dl>
        </div>
      )}

      {affordability.schedule && <p className="text-sm text-muted">{affordability.schedule.description}</p>}

      {hasAlternatives && (
        <div className="flex flex-col gap-3">
          <p className="text-sm font-semibold text-foreground">Ways to make it fit</p>
          {later && (
            <Alternative icon={CalendarClock} title={`Move the date to ${formatMonthYear(later.target_date)}`}>
              <p>
                {formatRupees(later.monthly_needed)} a month for {later.months} months. Prices keep rising, so it would
                cost about {formatRupees(later.future_cost)} by then.
              </p>
              {later.approach.key !== plan.approach.key && (
                <p className="flex flex-wrap items-center gap-2">
                  That&apos;s long enough for a {later.approach.label.toLowerCase()} approach, which assumes{" "}
                  {formatPercent(later.approach.annual_rate)} a year and carries more risk.
                  <RiskBadge risk={later.approach.risk} />
                </p>
              )}
            </Alternative>
          )}
          {lower && (
            <Alternative icon={TrendingDown} title={`Aim for ${formatRupees(lower.cost_today)} in today's prices`}>
              <p>
                {lower.monthly_needed === 0
                  ? "What you've already saved would cover it by your target date."
                  : `${formatRupees(lower.monthly_needed)} a month by your target date (about ${formatRupees(lower.future_cost)} by then).`}
              </p>
            </Alternative>
          )}
          {loan && (
            <Alternative icon={Landmark} title="Buy on time with a loan">
              <Badge variant="warning" className="w-fit">Illustration only</Badge>
              <p>
                Save {formatRupees(loan.monthly_savings)} a month until then for a down payment of about{" "}
                {formatRupees(loan.down_payment)}, and borrow {formatRupees(loan.loan_amount)}.
              </p>
              <p>
                Afterwards: an EMI of {formatRupees(loan.emi)} a month for {loan.term_months / 12} years at an assumed{" "}
                {formatPercent(loan.annual_rate, 0)}, about {formatRupees(loan.total_interest)} in interest in all.{" "}
                {loan.emi_fits ? "The EMI fits within what you can comfortably commit." : "The EMI is more than you can comfortably commit."}
              </p>
              <p className="text-xs">{loan.note}</p>
            </Alternative>
          )}
        </div>
      )}

      {affordability.notes.length > 0 && (
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted">
          {affordability.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}

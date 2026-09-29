import { AppShell } from "@/components/shell/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatINR } from "@/lib/format";
import { mockTaxComparison, type RegimeBreakdown } from "@/lib/mock";
import { cn } from "@/lib/cn";

function Row({
  label,
  amount,
  isOutput,
}: {
  label: string;
  amount: number;
  isOutput?: boolean;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={cn("text-sm", isOutput ? "font-medium text-foreground" : "text-muted")}>
        {label}
      </span>
      <span
        className={cn(
          "font-mono text-amount-sm",
          isOutput ? "text-foreground" : "text-muted",
        )}
      >
        {formatINR(amount)}
      </span>
    </div>
  );
}

function RegimeCard({
  name,
  data,
  recommended,
}: {
  name: string;
  data: RegimeBreakdown;
  recommended: boolean;
}) {
  return (
    <Card className={recommended ? "ring-2 ring-accent" : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-h2">{name}</h3>
        {recommended && <Badge variant="accent">Recommended</Badge>}
      </div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">Inputs</p>
      <div className="divide-y divide-border">
        <Row label="Gross income" amount={data.grossIncome} />
        <Row label="Standard deduction" amount={data.standardDeduction} />
        <Row label="Section 80C" amount={data.section80C} />
        <Row label="Section 80D" amount={data.section80D} />
        <Row label="HRA exemption" amount={data.hraExemption} />
        <Row label="Other deductions" amount={data.otherDeductions} />
      </div>
      <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-muted">Calculated</p>
      <div className="divide-y divide-border">
        <Row label="Taxable income" amount={data.taxableIncome} isOutput />
        <Row label="Tax before cess" amount={data.taxBeforeCess} isOutput />
        <Row label="Cess" amount={data.cess} isOutput />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md bg-surface-muted px-3 py-3">
        <span className="font-semibold text-foreground">Total tax</span>
        <span className="font-mono text-amount-lg text-foreground">
          {formatINR(data.totalTax)}
        </span>
      </div>
    </Card>
  );
}

export default function TaxComparisonPage() {
  const { oldRegime, newRegime, recommended, assessmentYear } = mockTaxComparison;
  const difference = Math.abs(oldRegime.totalTax - newRegime.totalTax);

  return (
    <AppShell title="Tax Comparison">
      <DemoBanner label="DEMO / MOCK DATA — tax calculation logic (Phase 3) is not implemented yet" />

      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-muted">{assessmentYear}</p>
        <Card className="px-4 py-2">
          <span className="text-sm text-muted">Difference: </span>
          <span className="font-mono font-semibold text-foreground">{formatINR(difference)}</span>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <RegimeCard name="Old Regime" data={oldRegime} recommended={recommended === "old"} />
        <RegimeCard name="New Regime" data={newRegime} recommended={recommended === "new"} />
      </div>
    </AppShell>
  );
}

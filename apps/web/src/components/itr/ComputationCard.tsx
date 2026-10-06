import type { RegimeComputation } from "@/lib/itr/types";
import { Card } from "@/components/ui/Card";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/cn";

function Row({
  label,
  amount,
  isOutput,
  indent,
}: {
  label: string;
  amount: number;
  isOutput?: boolean;
  indent?: boolean;
}) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-2", indent && "pl-4")}>
      <span className={cn("text-sm", isOutput ? "font-medium text-foreground" : "text-muted")}>{label}</span>
      <span className={cn("shrink-0 text-amount-sm", isOutput ? "text-foreground" : "text-muted")}>
        {formatRupees(amount)}
      </span>
    </div>
  );
}

function breakupLabel(key: string): string {
  return `Section ${key}`;
}

export function ComputationCard({ data }: { data: RegimeComputation }) {
  const breakup = Object.entries(data.deduction_breakup).filter(([, amount]) => amount > 0);
  const payable = data.balance_payable > 0;

  return (
    <Card>
      <h3 className="text-h2 mb-2">
        Computation – {data.regime === "new" ? "New" : "Old"} regime
      </h3>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">Income</p>
      <div className="divide-y divide-border">
        <Row label="Gross salary" amount={data.gross_salary} />
        <Row label="Less: exempt allowances" amount={data.exempt_allowances} indent />
        <Row label="Less: standard deduction" amount={data.standard_deduction} indent />
        <Row label="Less: professional tax" amount={data.professional_tax} indent />
        <Row label="Income from salary" amount={data.income_from_salary} isOutput />
        <Row label="Income from house property" amount={data.income_from_house_property} isOutput />
        <Row label="Income from other sources" amount={data.income_from_other_sources} isOutput />
        {data.family_pension_deduction > 0 && (
          <Row label="Less: family pension deduction u/s 57(iia)" amount={data.family_pension_deduction} indent />
        )}
        <Row label="Gross total income" amount={data.gross_total_income} isOutput />
        <Row label="Deductions (Chapter VI-A)" amount={data.chapter_via_deductions} />
        {breakup.map(([key, amount]) => (
          <Row key={key} label={breakupLabel(key)} amount={amount} indent />
        ))}
        <Row label="Total income" amount={data.total_income} isOutput />
      </div>

      <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-muted">Tax</p>
      <div className="divide-y divide-border">
        <Row label="Tax on total income" amount={data.tax_on_total_income} isOutput />
        <Row label="Rebate (Section 87A)" amount={data.rebate_87a} />
        <Row label="Tax after rebate" amount={data.tax_after_rebate} isOutput />
        {data.surcharge > 0 && <Row label="Surcharge" amount={data.surcharge} />}
        <Row label="Health & education cess" amount={data.cess} />
        <Row label="Gross tax liability" amount={data.gross_tax_liability} isOutput />
        <Row label="Interest u/s 234A" amount={data.interest_234a} />
        <Row label="Interest u/s 234B" amount={data.interest_234b} />
        <Row label="Interest u/s 234C" amount={data.interest_234c} />
        <Row label="Late fee u/s 234F" amount={data.fee_234f} />
        <Row label="Total tax, interest and fee" amount={data.total_tax_and_interest} isOutput />
      </div>

      <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-muted">Taxes paid</p>
      <div className="divide-y divide-border">
        <Row label="TDS" amount={data.tds} />
        <Row label="TCS" amount={data.tcs} />
        <Row label="Advance tax" amount={data.advance_tax} />
        <Row label="Self-assessment tax" amount={data.self_assessment_tax} />
        <Row label="Total taxes paid" amount={data.total_taxes_paid} isOutput />
      </div>

      <div
        className={cn(
          "mt-4 flex items-center justify-between rounded-md px-3 py-3",
          payable ? "bg-warning-bg" : "bg-success-bg",
        )}
      >
        <span className="font-semibold text-foreground">{payable ? "Balance tax payable" : "Refund due"}</span>
        <span className={cn("text-amount-lg", payable ? "text-warning" : "text-success")}>
          {formatRupees(payable ? data.balance_payable : data.refund_due)}
        </span>
      </div>
    </Card>
  );
}

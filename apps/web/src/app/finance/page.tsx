"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Wallet } from "lucide-react";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { SectionError, SectionSkeleton } from "@/components/dashboard/SectionStatus";
import {
  ActionsCard,
  AlertsCard,
  DocumentsCard,
  FilingCard,
  formatDate,
  IncomeCard,
  InvestmentsCard,
  TaxCard,
  TaxSavingCard,
  Tile,
} from "@/components/finance/OverviewCards";
import { AppShell } from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { getFinanceOverview } from "@/lib/finance/api";
import { formatRupees } from "@/lib/format";
import type { FinanceOverview } from "@/lib/finance/types";

const SOURCE_LABELS = {
  itr_filing: "your documents and ITR draft",
  tax_comparison: "your tax comparison",
} as const;

/**
 * One overview of the user's money, built from their documents, ITR draft,
 * tax comparison, tax plan, recommendations and tax calendar. Every figure is
 * real; a card without data says what to add instead of showing a number.
 */
export default function FinancePage() {
  const overview = useQuery({ queryKey: ["finance-overview"], queryFn: getFinanceOverview, refetchOnMount: "always" });

  return (
    <AppShell title="Finance Management">
      {overview.isPending ? (
        <Card className="bg-card border-line">
          <SectionSkeleton lines={6} />
        </Card>
      ) : overview.isError ? (
        <SectionError message="We couldn't load your finances." onRetry={() => void overview.refetch()} />
      ) : (
        <Overview data={overview.data} />
      )}
    </AppShell>
  );
}

function Overview({ data }: { data: FinanceOverview }) {
  const { income, tax } = data;
  return (
    <div className="flex flex-col gap-6">
      {data.source ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="success">Live data</Badge>
          <p className="text-sm text-muted">
            From {SOURCE_LABELS[data.source]}
            {data.financial_year && <> · FY {data.financial_year}</>}
            {data.updated_at && <> · updated {formatDate(data.updated_at)}</>}
          </p>
        </div>
      ) : (
        <Card className="bg-card border-line">
          <EmptyPanel
            icon={Wallet}
            title="Your finances will appear here"
            description="Upload your Form 16, AIS, payslips or broker statements — or run a tax comparison — and MoneyMitra builds this overview from them."
            action={
              <div className="flex flex-wrap justify-center gap-2">
                <Link href="/documents">
                  <Button size="sm">Upload documents</Button>
                </Link>
                <Link href="/tax-comparison">
                  <Button variant="secondary" size="sm">
                    Compare tax regimes
                  </Button>
                </Link>
              </div>
            }
          />
        </Card>
      )}

      {income && tax && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Tile label="Gross total income" value={formatRupees(income.total)} hint={`FY ${data.financial_year ?? ""}`} />
          <Tile label="Estimated tax" value={formatRupees(tax.tax)} hint={`${tax.effective_rate}% of income · ${tax.regime} regime`} />
          {tax.refund_due ? (
            <Tile label="Refund due" value={formatRupees(tax.refund_due)} hint="TDS paid is more than your tax" tone="success" />
          ) : tax.balance_payable ? (
            <Tile label="Tax still to pay" value={formatRupees(tax.balance_payable)} hint="Including interest and late fee" tone="error" />
          ) : (
            <Tile
              label={tax.savings ? "Saved by the better regime" : "Taxes paid"}
              value={formatRupees(tax.savings ?? tax.taxes_paid ?? 0)}
              hint={tax.savings ? `Choosing the ${tax.regime} regime` : undefined}
            />
          )}
          {income.monthly_take_home !== null ? (
            <Tile label="Monthly take-home" value={formatRupees(income.monthly_take_home)} hint="Salary after TDS & professional tax" />
          ) : (
            <Tile label="Monthly income" value={formatRupees(Math.round(income.total / 12))} hint="Gross, before tax" />
          )}
        </div>
      )}

      {(income || tax) && (
        <div className="grid gap-6 lg:grid-cols-3">
          {income && <IncomeCard income={income} />}
          {tax && <TaxCard tax={tax} />}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <InvestmentsCard investments={data.investments} />
        <TaxSavingCard sections={data.tax_saving} year={data.tax_saving_year} note={data.tax_saving_note} />
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <FilingCard filing={data.filing} />
        <DocumentsCard documents={data.documents} />
        <ActionsCard actions={data.actions} />
        <AlertsCard alerts={data.alerts} />
      </div>
    </div>
  );
}

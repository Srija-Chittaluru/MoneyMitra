"use client";

import { useState } from "react";
import { AppShell } from "@/components/shell/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { TransactionRow } from "@/components/ui/TransactionRow";
import { formatINR } from "@/lib/format";
import {
  mockFinanceTaxOverview,
  mockInvestments,
  mockSavingsInsights,
  mockSpendingSummary,
  mockTransactions,
} from "@/lib/mock";

const TABS = ["Overview", "Expenses", "Investments", "Tax", "Insights"] as const;
type Tab = (typeof TABS)[number];

function OverviewTab() {
  const totalSpend = mockSpendingSummary.reduce((sum, c) => sum + c.amount, 0);
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card>
        <p className="text-sm text-muted">This month&apos;s spending</p>
        <p className="mt-2 text-amount-lg">{formatINR(totalSpend)}</p>
      </Card>
      <Card>
        <p className="text-sm text-muted">Estimated annual tax</p>
        <p className="mt-2 text-amount-lg">
          {formatINR(mockFinanceTaxOverview.estimatedAnnualTax)}
        </p>
      </Card>
      <Card>
        <p className="text-sm text-muted">Savings insights</p>
        <p className="mt-2 text-h2">{mockSavingsInsights.length} new</p>
      </Card>
    </div>
  );
}

function ExpensesTab() {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h3 className="text-h2 mb-3">Spending by category</h3>
        <div className="divide-y divide-border">
          {mockSpendingSummary.map((c) => (
            <div key={c.category} className="flex items-center justify-between py-2">
              <span className="text-muted">{c.category}</span>
              <span>{formatINR(c.amount)}</span>
            </div>
          ))}
        </div>
      </Card>
      <Card>
        <h3 className="text-h2 mb-3">Recent transactions</h3>
        <div className="divide-y divide-border">
          {mockTransactions.map((tx) => (
            <TransactionRow key={tx.id} {...tx} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function InvestmentsTab() {
  return (
    <Card>
      <h3 className="text-h2 mb-3">Investment overview</h3>
      <div className="divide-y divide-border">
        {mockInvestments.map((inv) => {
          const change = inv.current - inv.invested;
          const pct = ((change / inv.invested) * 100).toFixed(1);
          return (
            <div key={inv.id} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-foreground">{inv.name}</p>
                <p className="text-sm text-muted">{inv.type}</p>
              </div>
              <div className="text-right">
                <p className="text-amount-sm">{formatINR(inv.current)}</p>
                <p className={`text-sm ${change >= 0 ? "text-success" : "text-error"}`}>
                  {change >= 0 ? "+" : ""}
                  {pct}%
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function TaxTab() {
  return (
    <Card className="max-w-md">
      <h3 className="text-h2 mb-3">Tax overview</h3>
      <div className="divide-y divide-border">
        <div className="flex items-center justify-between py-2">
          <span className="text-muted">Estimated annual tax</span>
          <span>{formatINR(mockFinanceTaxOverview.estimatedAnnualTax)}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-muted">Recommended regime</span>
          <span className="capitalize font-medium">{mockFinanceTaxOverview.regime}</span>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-muted">Next filing deadline</span>
          <span>{mockFinanceTaxOverview.nextDeadline}</span>
        </div>
      </div>
    </Card>
  );
}

function InsightsTab() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {mockSavingsInsights.map((insight) => (
        <Card key={insight.id}>
          <h3 className="text-h2 mb-2">{insight.title}</h3>
          <p className="text-body text-muted">{insight.description}</p>
        </Card>
      ))}
    </div>
  );
}

export default function FinancePage() {
  const [tab, setTab] = useState<Tab>("Overview");

  return (
    <AppShell title="Finance Management">
      <DemoBanner />
      <div className="mb-6">
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </div>

      {tab === "Overview" && <OverviewTab />}
      {tab === "Expenses" && <ExpensesTab />}
      {tab === "Investments" && <InvestmentsTab />}
      {tab === "Tax" && <TaxTab />}
      {tab === "Insights" && <InsightsTab />}
    </AppShell>
  );
}

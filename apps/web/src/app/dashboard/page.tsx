"use client";

import Link from "next/link";
import { AppShell } from "@/components/shell/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { StatTile } from "@/components/ui/StatTile";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TransactionRow } from "@/components/ui/TransactionRow";
import { formatINR } from "@/lib/format";
import { useAuth } from "@/lib/auth/AuthContext";
import {
  mockDashboardSummary,
  mockTaxComparison,
  mockTaxSavingRecommendations,
  mockTransactions,
} from "@/lib/mock";

export default function DashboardPage() {
  const { user } = useAuth();
  const { annualIncome, documentStatus } = mockDashboardSummary;
  const savingsPotential =
    mockTaxComparison.oldRegime.totalTax - mockTaxComparison.newRegime.totalTax;

  return (
    <AppShell title="Dashboard">
      <DemoBanner />

      <h2 className="text-h1 mb-6">Welcome back, {user?.name.split(" ")[0]}</h2>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Annual income" amount={annualIncome} />
        <StatTile
          label="Estimated tax"
          amount={mockTaxComparison.newRegime.totalTax}
          helpText={`Under the ${mockTaxComparison.recommended} regime`}
        />
        <StatTile
          label="Potential savings"
          amount={savingsPotential}
          helpText="By choosing the better regime"
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-h2">Old vs. new regime</h3>
            <Link href="/tax-comparison">
              <Button variant="ghost" size="sm">
                Full comparison
              </Button>
            </Link>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-md border border-border p-4">
              <p className="text-sm text-muted">Old regime</p>
              <p className="mt-1 text-amount-lg">
                {formatINR(mockTaxComparison.oldRegime.totalTax)}
              </p>
            </div>
            <div className="rounded-md border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">New regime</p>
                {mockTaxComparison.recommended === "new" && (
                  <Badge variant="accent">Recommended</Badge>
                )}
              </div>
              <p className="mt-1 text-amount-lg">
                {formatINR(mockTaxComparison.newRegime.totalTax)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-h2 mb-4">Document status</h3>
          <div className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted">Form 16</span>
              <Badge variant="success">Processed</Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Payslips</span>
              <span>
                {documentStatus.payslipsUploaded}/{documentStatus.payslipsExpected}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted">Tax proofs pending</span>
              <span>{documentStatus.taxProofsPending}</span>
            </div>
          </div>
          <Link href="/documents">
            <Button variant="secondary" size="sm" className="mt-4 w-full">
              Manage documents
            </Button>
          </Link>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-h2">Recommendations for you</h3>
            <Link href="/recommendations">
              <Button variant="ghost" size="sm">
                View all
              </Button>
            </Link>
          </div>
          <div className="flex flex-col divide-y divide-border">
            {mockTaxSavingRecommendations.slice(0, 2).map((rec) => (
              <div key={rec.id} className="py-3">
                <p className="font-medium text-foreground">{rec.title}</p>
                <p className="text-sm text-muted">{rec.description}</p>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-h2 mb-2">Recent activity</h3>
          <div className="divide-y divide-border">
            {mockTransactions.slice(0, 4).map((tx) => (
              <TransactionRow key={tx.id} {...tx} />
            ))}
          </div>
        </Card>
      </div>
    </AppShell>
  );
}

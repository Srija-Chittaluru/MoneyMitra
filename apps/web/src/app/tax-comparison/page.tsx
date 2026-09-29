"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatINR } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/lib/auth/AuthContext";
import { ApiError } from "@/lib/api-client";
import { compareTaxRegimes, getSupportedTaxYears } from "@/lib/tax/api";
import type { RegimeResult, TaxComparisonResult } from "@/lib/tax/types";

function Row({ label, amount, isOutput }: { label: string; amount: number; isOutput?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className={cn("text-sm", isOutput ? "font-medium text-foreground" : "text-muted")}>
        {label}
      </span>
      <span className={cn("font-mono text-amount-sm", isOutput ? "text-foreground" : "text-muted")}>
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
  data: RegimeResult;
  recommended: boolean;
}) {
  return (
    <Card className={recommended ? "ring-2 ring-accent" : undefined}>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-h2">{name}</h3>
        {recommended && <Badge variant="accent">Lower estimated tax</Badge>}
      </div>
      <p className="mb-2 text-xs uppercase tracking-wide text-muted">Inputs</p>
      <div className="divide-y divide-border">
        <Row label="Gross total income" amount={data.gross_total_income} />
        <Row label="Total deductions" amount={data.total_deductions} />
      </div>
      <p className="mb-2 mt-4 text-xs uppercase tracking-wide text-muted">Calculated</p>
      <div className="divide-y divide-border">
        <Row label="Taxable income" amount={data.taxable_income} isOutput />
        <Row label="Tax before rebate" amount={data.tax_before_rebate} isOutput />
        <Row label="Rebate (Section 87A)" amount={data.rebate} isOutput />
        <Row label="Tax after rebate" amount={data.tax_after_rebate} isOutput />
        <Row label="Surcharge" amount={data.surcharge} isOutput />
        <Row label="Cess" amount={data.cess} isOutput />
      </div>
      <div className="mt-4 flex items-center justify-between rounded-md bg-surface-muted px-3 py-3">
        <span className="font-semibold text-foreground">Estimated tax payable</span>
        <span className="font-mono text-amount-lg text-foreground">
          {formatINR(data.total_tax_payable)}
        </span>
      </div>
    </Card>
  );
}

export default function TaxComparisonPage() {
  const { user } = useAuth();

  const yearsQuery = useQuery({ queryKey: ["tax-years"], queryFn: getSupportedTaxYears });

  const [taxYear, setTaxYear] = useState("");
  const [grossIncome, setGrossIncome] = useState("");
  const [dob, setDob] = useState(user?.date_of_birth ?? "");
  const [section80c, setSection80c] = useState("");
  const [section80d, setSection80d] = useState("");
  const [hraExemption, setHraExemption] = useState("");
  const [otherDeductions, setOtherDeductions] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Falls back to the first supported year until the user picks one explicitly.
  const selectedTaxYear = taxYear || yearsQuery.data?.[0] || "";

  const mutation = useMutation<TaxComparisonResult, ApiError, void>({
    mutationFn: () => {
      const income = Number(grossIncome);
      return compareTaxRegimes({
        tax_year: selectedTaxYear,
        gross_total_income: income,
        date_of_birth: dob || undefined,
        section_80c: Number(section80c) || 0,
        section_80d: Number(section80d) || 0,
        hra_exemption: Number(hraExemption) || 0,
        other_deductions: Number(otherDeductions) || 0,
      });
    },
  });

  function isNonNegativeNumber(value: string): boolean {
    if (value.trim() === "") return true;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed >= 0;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);

    if (grossIncome.trim() === "" || !isNonNegativeNumber(grossIncome)) {
      setFieldError("Enter a valid gross total income (0 or more).");
      return;
    }
    for (const [label, value] of [
      ["Section 80C", section80c],
      ["Section 80D", section80d],
      ["HRA exemption", hraExemption],
      ["Other deductions", otherDeductions],
    ] as const) {
      if (!isNonNegativeNumber(value)) {
        setFieldError(`${label} must be 0 or more.`);
        return;
      }
    }

    mutation.mutate();
  }

  const result = mutation.data;

  return (
    <AppShell title="Tax Comparison">
      <p className="mb-6 text-sm text-muted">
        Estimated tax based on the information you entered. This is not personalized financial advice.
      </p>

      <Card className="mb-6">
        <h3 className="text-h2 mb-4">Your details</h3>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select
            id="tax-year"
            label="Tax year"
            value={selectedTaxYear}
            onChange={(e) => setTaxYear(e.target.value)}
            disabled={yearsQuery.isLoading}
          >
            {(yearsQuery.data ?? []).map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </Select>
          <Input
            id="gross-income"
            type="number"
            min={0}
            label="Gross total income (annual)"
            placeholder="e.g. 1200000"
            value={grossIncome}
            onChange={(e) => setGrossIncome(e.target.value)}
            required
          />
          <Input
            id="dob"
            type="date"
            label="Date of birth (optional)"
            hint="Used for old-regime age-based slabs"
            value={dob}
            onChange={(e) => setDob(e.target.value)}
          />
          <Input
            id="section-80c"
            type="number"
            min={0}
            label="Section 80C (optional)"
            placeholder="PF, ELSS, life insurance…"
            value={section80c}
            onChange={(e) => setSection80c(e.target.value)}
          />
          <Input
            id="section-80d"
            type="number"
            min={0}
            label="Section 80D (optional)"
            placeholder="Health insurance premium"
            value={section80d}
            onChange={(e) => setSection80d(e.target.value)}
          />
          <Input
            id="hra-exemption"
            type="number"
            min={0}
            label="HRA exemption (optional)"
            value={hraExemption}
            onChange={(e) => setHraExemption(e.target.value)}
          />
          <Input
            id="other-deductions"
            type="number"
            min={0}
            label="Other deductions (optional)"
            value={otherDeductions}
            onChange={(e) => setOtherDeductions(e.target.value)}
          />

          <div className="flex flex-col justify-end gap-2 sm:col-span-2 lg:col-span-3">
            {(fieldError || mutation.isError) && (
              <p className="text-sm text-error">
                {fieldError ?? mutation.error?.message ?? "Something went wrong. Please try again."}
              </p>
            )}
            <Button type="submit" variant="primary" disabled={mutation.isPending} className="sm:w-fit">
              {mutation.isPending ? "Calculating…" : result ? "Recalculate" : "Calculate comparison"}
            </Button>
          </div>
        </form>
      </Card>

      {result && (
        <>
          <div className="mb-6 flex items-center justify-between">
            <p className="text-body text-muted">Tax year {result.tax_year}</p>
            <Card className="px-4 py-2">
              <span className="text-sm text-muted">Difference: </span>
              <span className="font-mono font-semibold text-foreground">
                {formatINR(result.difference)}
              </span>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <RegimeCard
              name="Old Regime"
              data={result.old_regime}
              recommended={result.recommended_regime === "old"}
            />
            <RegimeCard
              name="New Regime"
              data={result.new_regime}
              recommended={result.recommended_regime === "new"}
            />
          </div>
        </>
      )}
    </AppShell>
  );
}

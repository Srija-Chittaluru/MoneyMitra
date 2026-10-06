import { PiggyBank } from "lucide-react";
import type { Dividends, OtherIncome } from "@/lib/itr/types";
import { AmountInput, GRID, SectionCard, TextInput } from "./fields";

const DIVIDEND_QUARTERS: { key: keyof Dividends; label: string }[] = [
  { key: "upto_15_jun", label: "Up to 15 Jun" },
  { key: "jun_16_to_sep_15", label: "16 Jun – 15 Sep" },
  { key: "sep_16_to_dec_15", label: "16 Sep – 15 Dec" },
  { key: "dec_16_to_mar_15", label: "16 Dec – 15 Mar" },
  { key: "mar_16_to_mar_31", label: "16 Mar – 31 Mar" },
];

export function OtherIncomeSection({
  income,
  onChange,
}: {
  income: OtherIncome;
  onChange: (income: OtherIncome) => void;
}) {
  const set = (patch: Partial<OtherIncome>) => onChange({ ...income, ...patch });

  return (
    <SectionCard
      title="Other Sources"
      icon={PiggyBank}
      prefixes={["other_income"]}
      filled={
        income.savings_interest + income.deposit_interest + income.refund_interest + income.family_pension + income.other_amount > 0 ||
        Object.values(income.dividends).some((v) => v > 0)
      }
      description="Interest from savings and deposits, dividends, family pension and other income — check your AIS."
    >
      <div className={GRID}>
        <AmountInput
          label="Savings account interest"
          path="other_income.savings_interest"
          value={income.savings_interest}
          onChange={(v) => set({ savings_interest: v })}
        />
        <AmountInput
          label="Fixed / recurring deposit interest"
          path="other_income.deposit_interest"
          value={income.deposit_interest}
          onChange={(v) => set({ deposit_interest: v })}
        />
        <AmountInput
          label="Interest on income tax refund"
          path="other_income.refund_interest"
          value={income.refund_interest}
          onChange={(v) => set({ refund_interest: v })}
        />
        <AmountInput
          label="Family pension"
          value={income.family_pension}
          onChange={(v) => set({ family_pension: v })}
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-muted">Dividends received</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {DIVIDEND_QUARTERS.map(({ key, label }) => (
          <AmountInput
            key={key}
            label={label}
            value={income.dividends[key]}
            onChange={(v) => set({ dividends: { ...income.dividends, [key]: v } })}
          />
        ))}
      </div>

      <p className="text-xs uppercase tracking-wide text-muted">Any other income</p>
      <div className={GRID}>
        <AmountInput label="Amount" value={income.other_amount} onChange={(v) => set({ other_amount: v })} />
        <div className="sm:col-span-1 lg:col-span-2">
          <TextInput
            label="Description"
            required={income.other_amount > 0}
            value={income.other_description}
            onChange={(v) => set({ other_description: v })}
          />
        </div>
      </div>
    </SectionCard>
  );
}

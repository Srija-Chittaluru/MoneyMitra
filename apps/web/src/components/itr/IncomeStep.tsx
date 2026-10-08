import { CandlestickChart, TrendingUp } from "lucide-react";
import type { CapitalAssetType, ItrDraftData, ItrForm, Trading } from "@/lib/itr/types";
import { formatRupees } from "@/lib/format";
import {
  AmountInput,
  GRID,
  ListSection,
  MAX_AMOUNT,
  Notice,
  SectionCard,
  SelectField,
  SwitchField,
  TextInput,
  YesNo,
} from "./fields";
import { HousePropertySection } from "./HousePropertySection";
import { OtherIncomeSection } from "./OtherIncomeSection";
import { SalarySection } from "./SalarySection";
import { emptyCapitalGain } from "./options";

const ASSET_TYPES: { value: CapitalAssetType; label: string }[] = [
  { value: "equity_share", label: "Listed shares" },
  { value: "equity_mf", label: "Equity mutual fund" },
  { value: "debt_mf", label: "Debt mutual fund" },
];

const TERMS = [
  { value: "short", label: "Short term" },
  { value: "long", label: "Long term" },
] as const;

function gainOf(t: ItrDraftData["capital_gains"][number]): number {
  let cost = t.cost;
  if (t.asset_type !== "debt_mf" && t.term === "long" && t.acquired_before_feb_2018) {
    cost = Math.max(cost, Math.min(t.fmv_31_jan_2018, t.sale_value));
  }
  return t.sale_value - cost - t.expenses;
}

function CapitalGainsSection({ draft, onChange }: { draft: ItrDraftData; onChange: (draft: ItrDraftData) => void }) {
  const txns = draft.capital_gains;
  const hasGains = draft.eligibility.has_capital_gains || txns.length > 0;
  const net = txns.reduce((sum, t) => sum + gainOf(t), 0);

  return (
    <SectionCard
      title="Capital Gains"
      icon={TrendingUp}
      prefixes={["capital_gains", "eligibility.has_capital_gains"]}
      filled={txns.length > 0}
      description="Sales of shares and mutual funds during the year — filled from your AIS. Reported in ITR-2 / ITR-3."
    >
      <YesNo
        label="Did you sell shares, mutual funds or other capital assets in FY 2025-26?"
        value={hasGains ? true : draft.eligibility.has_capital_gains}
        onChange={(value) => onChange({ ...draft, eligibility: { ...draft.eligibility, has_capital_gains: value } })}
      />
      {hasGains && (
        <>
          <Notice>
            Short-term gains on shares and equity funds are taxed at 20%, long-term at 12.5% above ₹1.25 lakh, and
            debt-fund gains at your slab rate. Check each sale against your broker&apos;s capital-gains statement.
          </Notice>
          <ListSection
            title={`Sales (${txns.length})`}
            hint={txns.length > 0 ? `Net gain ${formatRupees(net)}` : "Add each sale, or upload your AIS"}
            itemLabel="Sale"
            addLabel="Add sale"
            max={500}
            items={txns}
            onChange={(capital_gains) => onChange({ ...draft, capital_gains })}
            createItem={emptyCapitalGain}
            renderItem={(t, update, i) => (
              <div className="flex flex-col gap-4">
                <div className={GRID}>
                  <TextInput
                    label="Share / fund"
                    path={`capital_gains.${i}.name`}
                    required
                    value={t.name}
                    onChange={(v) => update({ name: v })}
                  />
                  <TextInput
                    label="ISIN"
                    path={`capital_gains.${i}.isin`}
                    required={t.term === "long" && t.asset_type !== "debt_mf"}
                    uppercase
                    maxLength={12}
                    value={t.isin}
                    onChange={(v) => update({ isin: v })}
                  />
                  <SelectField
                    label="Type"
                    path={`capital_gains.${i}.asset_type`}
                    value={t.asset_type}
                    options={ASSET_TYPES}
                    onChange={(v) => update({ asset_type: v ?? "equity_share" })}
                  />
                  <SelectField
                    label="Holding"
                    path={`capital_gains.${i}.term`}
                    value={t.term}
                    options={TERMS}
                    onChange={(v) => update({ term: v ?? "short" })}
                  />
                  <TextInput
                    label="Sale date"
                    path={`capital_gains.${i}.sale_date`}
                    required
                    type="date"
                    value={t.sale_date}
                    onChange={(v) => update({ sale_date: v })}
                  />
                  <AmountInput
                    label="Quantity"
                    path={`capital_gains.${i}.quantity`}
                    value={t.quantity}
                    onChange={(v) => update({ quantity: v })}
                  />
                  <AmountInput
                    label="Sale value"
                    path={`capital_gains.${i}.sale_value`}
                    required
                    value={t.sale_value}
                    onChange={(v) => update({ sale_value: v })}
                  />
                  <AmountInput
                    label="Cost of acquisition"
                    path={`capital_gains.${i}.cost`}
                    value={t.cost}
                    onChange={(v) => update({ cost: v })}
                  />
                  <AmountInput
                    label="Transfer expenses"
                    path={`capital_gains.${i}.expenses`}
                    hint="Brokerage etc. (not STT)"
                    value={t.expenses}
                    onChange={(v) => update({ expenses: v })}
                  />
                </div>
                {t.term === "long" && t.asset_type !== "debt_mf" && (
                  <div className={GRID}>
                    <SwitchField
                      label="Bought on or before 31 Jan 2018"
                      description="Grandfathering: cost can be the market value on 31 Jan 2018"
                      checked={t.acquired_before_feb_2018}
                      onChange={(v) => update({ acquired_before_feb_2018: v })}
                    />
                    {t.acquired_before_feb_2018 && (
                      <AmountInput
                        label="Market value on 31 Jan 2018"
                        value={t.fmv_31_jan_2018}
                        onChange={(v) => update({ fmv_31_jan_2018: v })}
                      />
                    )}
                  </div>
                )}
                <p className="text-sm text-muted">
                  Gain: <span className="text-foreground">{formatRupees(gainOf(t))}</span>
                </p>
              </div>
            )}
          />
        </>
      )}
    </SectionCard>
  );
}

function SignedAmountInput({
  label,
  path,
  value,
  onChange,
}: {
  label: string;
  path: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <TextInput
      label={label}
      path={path}
      inputMode="numeric"
      placeholder="0"
      value={value ? String(value) : ""}
      onChange={(v) => {
        const parsed = Math.trunc(Number((v ?? "").replace(/[^\d-]/g, ""))) || 0;
        onChange(Math.max(-MAX_AMOUNT, Math.min(parsed, MAX_AMOUNT)));
      }}
    />
  );
}

function TradingSection({ draft, onChange }: { draft: ItrDraftData; onChange: (draft: ItrDraftData) => void }) {
  const t = draft.trading;
  const set = (patch: Partial<Trading>) => onChange({ ...draft, trading: { ...t, ...patch } });
  const filled = !!(t.speculative_turnover || t.speculative_profit || t.fno_turnover || t.fno_profit);

  return (
    <SectionCard
      title="Share Trading (Intraday / F&O)"
      icon={CandlestickChart}
      prefixes={["trading"]}
      filled={filled}
      description="Intraday trades are speculative business income and F&O is business income — both are filed in ITR-3. Use your broker's tax P&L."
    >
      <p className="text-xs uppercase tracking-wide text-muted">Intraday (speculative)</p>
      <div className={GRID}>
        <AmountInput
          label="Turnover"
          path="trading.speculative_turnover"
          hint="Sum of absolute profit/loss of each trade"
          value={t.speculative_turnover}
          onChange={(v) => set({ speculative_turnover: v })}
        />
        <SignedAmountInput
          label="Net profit (negative for a loss)"
          path="trading.speculative_profit"
          value={t.speculative_profit}
          onChange={(v) => set({ speculative_profit: v })}
        />
      </div>
      <p className="text-xs uppercase tracking-wide text-muted">Futures & options</p>
      <div className={GRID}>
        <AmountInput
          label="Turnover"
          path="trading.fno_turnover"
          value={t.fno_turnover}
          onChange={(v) => set({ fno_turnover: v })}
        />
        <SignedAmountInput
          label="Profit before expenses (negative for a loss)"
          path="trading.fno_profit"
          value={t.fno_profit}
          onChange={(v) => set({ fno_profit: v })}
        />
        <AmountInput
          label="Expenses"
          path="trading.fno_expenses"
          hint="Brokerage, advisory, internet…"
          value={t.fno_expenses}
          onChange={(v) => set({ fno_expenses: v })}
        />
      </div>
    </SectionCard>
  );
}

export function IncomeStep({
  draft,
  onChange,
  form,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
  form?: ItrForm;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SalarySection
        salary={draft.salary}
        regime={draft.regime}
        employerAddressRequired={form === "ITR-2" || form === "ITR-3"}
        onChange={(salary) => onChange({ ...draft, salary })}
      />
      <HousePropertySection
        properties={draft.house_properties}
        onChange={(house_properties) => onChange({ ...draft, house_properties })}
      />
      <OtherIncomeSection
        income={draft.other_income}
        onChange={(other_income) => onChange({ ...draft, other_income })}
      />
      <CapitalGainsSection draft={draft} onChange={onChange} />
      <TradingSection draft={draft} onChange={onChange} />
    </div>
  );
}

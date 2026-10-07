import { TrendingUp } from "lucide-react";
import type { ItrDraftData } from "@/lib/itr/types";
import { Notice, SectionCard, YesNo } from "./fields";
import { HousePropertySection } from "./HousePropertySection";
import { OtherIncomeSection } from "./OtherIncomeSection";
import { SalarySection } from "./SalarySection";

function CapitalGainsSection({ draft, onChange }: { draft: ItrDraftData; onChange: (draft: ItrDraftData) => void }) {
  const hasGains = draft.eligibility.has_capital_gains;
  return (
    <SectionCard
      title="Capital Gains"
      icon={TrendingUp}
      prefixes={["eligibility.has_capital_gains"]}
      description="Sale of shares, mutual funds, property or other capital assets during the year."
    >
      <YesNo
        label="Did you sell shares, mutual funds, property or other capital assets in FY 2025-26?"
        value={hasGains}
        onChange={(value) => onChange({ ...draft, eligibility: { ...draft.eligibility, has_capital_gains: value } })}
      />
      {hasGains && (
        <Notice variant="warning" title="Capital gains need ITR-2">
          ITR-1 can&apos;t report capital gains (other than small exempt long-term gains). MoneyMitra supports ITR-1
          for now — file ITR-2 with the official Income Tax utility, or wait for ITR-2 support here.
        </Notice>
      )}
    </SectionCard>
  );
}

export function IncomeStep({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <SalarySection
        salary={draft.salary}
        regime={draft.regime}
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
    </div>
  );
}

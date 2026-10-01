import type { ItrDraftData } from "@/lib/itr/types";
import { HousePropertySection } from "./HousePropertySection";
import { OtherIncomeSection } from "./OtherIncomeSection";
import { SalarySection } from "./SalarySection";

export function IncomeStep({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  return (
    <div className="flex flex-col gap-6">
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
    </div>
  );
}

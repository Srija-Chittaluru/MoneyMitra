import type { Deductions, HealthInsurance, ItrDraftData } from "@/lib/itr/types";
import { HeartPulse, Landmark, PiggyBank } from "lucide-react";
import { AmountInput, GRID, ListSection, Notice, SectionCard, SwitchField, TextInput, useSectionMode } from "./fields";
import { empty80CItem, emptyHealthPolicy } from "./options";

function HealthBucket({
  title,
  description,
  health,
  onChange,
}: {
  title: string;
  description: string;
  health: HealthInsurance;
  onChange: (health: HealthInsurance) => void;
}) {
  const set = (patch: Partial<HealthInsurance>) => onChange({ ...health, ...patch });

  return (
    <div className="flex flex-col gap-4 rounded-md border border-border p-4">
      <SwitchField
        label={title}
        description={description}
        checked={health.claiming}
        onChange={(claiming) => set({ claiming })}
      />
      {health.claiming && (
        <>
          <SwitchField
            label="Includes a senior citizen (60+)"
            description="Raises the limit to ₹50,000"
            checked={health.includes_senior_citizen}
            onChange={(includes_senior_citizen) => set({ includes_senior_citizen })}
          />
          <ListSection
            title="Health insurance policies"
            itemLabel="Policy"
            addLabel="Add policy"
            items={health.policies}
            onChange={(policies) => set({ policies })}
            createItem={emptyHealthPolicy}
            renderItem={(policy, update) => (
              <div className={GRID}>
                <TextInput label="Insurer" required={policy.premium > 0} value={policy.insurer} onChange={(v) => update({ insurer: v })} />
                <TextInput label="Policy no." required={policy.premium > 0} value={policy.policy_no} onChange={(v) => update({ policy_no: v })} />
                <AmountInput label="Premium paid" value={policy.premium} onChange={(v) => update({ premium: v })} />
              </div>
            )}
          />
          <div className={GRID}>
            <AmountInput
              label="Preventive health check-up"
              hint="Up to ₹5,000, within the overall limit"
              value={health.preventive_checkup}
              onChange={(v) => set({ preventive_checkup: v })}
            />
            {health.includes_senior_citizen && (
              <AmountInput
                label="Medical expenditure"
                hint="For a senior citizen without health insurance"
                value={health.medical_expenditure}
                onChange={(v) => set({ medical_expenditure: v })}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function DeductionsStep({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  const deductions = draft.deductions;
  const { onlyIssues } = useSectionMode();
  const set = (patch: Partial<Deductions>) => onChange({ ...draft, deductions: { ...deductions, ...patch } });

  const claimsNps = deductions.section_80ccd_1b > 0 || deductions.section_80ccd_2 > 0;

  return (
    <div className="flex flex-col gap-6">
      {!onlyIssues && (
        <Notice title="Save tax with deductions">
          These deductions reduce your tax under the <span className="font-medium">old regime</span> only. Enter
          what applies — Tax Summary compares both regimes for you. 80TTA / 80TTB on interest income are
          calculated automatically.
        </Notice>
      )}

      <SectionCard
        title="Section 80C"
        icon={PiggyBank}
        prefixes={["deductions.section_80c"]}
        filled={deductions.section_80c.length > 0}
        description="PF, PPF, ELSS, life insurance, tuition fees, home-loan principal… (limit ₹1,50,000)."
        defaultOpen
      >
        <ListSection
          title="Investments and payments"
          itemLabel="Item"
          addLabel="Add item"
          items={deductions.section_80c}
          onChange={(section_80c) => set({ section_80c })}
          createItem={empty80CItem}
          renderItem={(item, update) => (
            <div className={GRID}>
              <TextInput label="Description" value={item.description} onChange={(v) => update({ description: v })} />
              <TextInput
                label="Policy / account no."
                required={item.amount > 0}
                value={item.identification_no}
                onChange={(v) => update({ identification_no: v })}
              />
              <AmountInput label="Amount" value={item.amount} onChange={(v) => update({ amount: v })} />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard
        title="NPS – Section 80CCD"
        icon={Landmark}
        prefixes={["deductions.section_80ccd_1b", "deductions.section_80ccd_2", "deductions.pran"]}
        filled={deductions.section_80ccd_1b > 0 || deductions.section_80ccd_2 > 0}
        description="Your own NPS contribution (extra ₹50,000) and your employer's contribution. Employer NPS also counts under the new regime."
      >
        <div className={GRID}>
          <AmountInput
            label="Own contribution – 80CCD(1B)"
            hint="Up to ₹50,000 over and above 80C"
            value={deductions.section_80ccd_1b}
            onChange={(v) => set({ section_80ccd_1b: v })}
          />
          <AmountInput
            label="Employer contribution – 80CCD(2)"
            value={deductions.section_80ccd_2}
            onChange={(v) => set({ section_80ccd_2: v })}
          />
          <TextInput
            label="PRAN"
            required={claimsNps}
            value={deductions.pran}
            onChange={(v) => set({ pran: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Section 80D – Health Insurance"
        icon={HeartPulse}
        prefixes={["deductions.health_self", "deductions.health_parents"]}
        filled={deductions.health_self.claiming || deductions.health_parents.claiming}
        description="Medical insurance premiums and preventive health check-ups for you, your family and parents."
      >
        <HealthBucket
          title="Self, spouse and children"
          description="Limit ₹25,000 (₹50,000 if anyone is a senior citizen)"
          health={deductions.health_self}
          onChange={(health_self) => set({ health_self })}
        />
        <HealthBucket
          title="Parents"
          description="Limit ₹25,000 (₹50,000 if a parent is a senior citizen)"
          health={deductions.health_parents}
          onChange={(health_parents) => set({ health_parents })}
        />
      </SectionCard>
    </div>
  );
}

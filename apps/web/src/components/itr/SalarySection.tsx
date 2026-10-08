import { Briefcase } from "lucide-react";
import type { HraInputs, Regime, SalaryInfo } from "@/lib/itr/types";
import { AmountInput, GRID, ListSection, Notice, SectionCard, SelectField, SwitchField, TextInput } from "./fields";
import { STATES, emptyEmployer } from "./options";

export function SalarySection({
  salary,
  regime,
  onChange,
  employerAddressRequired = false,
}: {
  salary: SalaryInfo;
  regime: Regime;
  onChange: (salary: SalaryInfo) => void;
  employerAddressRequired?: boolean;
}) {
  const set = (patch: Partial<SalaryInfo>) => onChange({ ...salary, ...patch });
  const setHra = (patch: Partial<HraInputs>) => set({ hra: { ...salary.hra, ...patch } });
  const isOld = regime === "old";

  return (
    <SectionCard
      title="Salary"
      icon={Briefcase}
      prefixes={["salary"]}
      filled={salary.salary_17_1 > 0 || salary.employers.length > 0}
      description="Salary, allowances and employer TDS — from Form 16 Part A and Part B."
      defaultOpen
    >
      <div className={GRID}>
        <AmountInput label="Salary u/s 17(1)" path="salary.salary_17_1" value={salary.salary_17_1} onChange={(v) => set({ salary_17_1: v })} />
        <AmountInput
          label="Perquisites u/s 17(2)"
          path="salary.perquisites_17_2"
          value={salary.perquisites_17_2}
          onChange={(v) => set({ perquisites_17_2: v })}
        />
        <AmountInput
          label="Profits in lieu of salary u/s 17(3)"
          path="salary.profits_17_3"
          value={salary.profits_17_3}
          onChange={(v) => set({ profits_17_3: v })}
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-muted">Exempt allowances</p>
      <div className={GRID}>
        <AmountInput
          label="Gratuity exemption u/s 10(10)"
          path="salary.gratuity_exemption"
          value={salary.gratuity_exemption}
          onChange={(v) => set({ gratuity_exemption: v })}
        />
        <AmountInput
          label="Leave encashment u/s 10(10AA)"
          path="salary.leave_encashment_exemption"
          value={salary.leave_encashment_exemption}
          onChange={(v) => set({ leave_encashment_exemption: v })}
        />
      </div>

      <p className="text-xs uppercase tracking-wide text-muted">Old regime only</p>
      {!isOld && (
        <Notice>
          HRA, LTA and professional tax only reduce your income under the old regime. You can switch regimes in
          step 5.
        </Notice>
      )}
      <div className={GRID}>
        <AmountInput
          label="Basic salary"
          path="salary.hra.basic_salary"
          disabled={!isOld}
          value={salary.hra.basic_salary}
          onChange={(v) => setHra({ basic_salary: v })}
        />
        <AmountInput
          label="Dearness allowance"
          path="salary.hra.dearness_allowance"
          disabled={!isOld}
          value={salary.hra.dearness_allowance}
          onChange={(v) => setHra({ dearness_allowance: v })}
        />
        <AmountInput
          label="HRA received"
          path="salary.hra.hra_received"
          disabled={!isOld}
          value={salary.hra.hra_received}
          onChange={(v) => setHra({ hra_received: v })}
        />
        <AmountInput
          label="Rent paid"
          disabled={!isOld}
          value={salary.hra.rent_paid}
          onChange={(v) => setHra({ rent_paid: v })}
        />
        <AmountInput
          label="LTA exemption u/s 10(5)"
          disabled={!isOld}
          value={salary.lta_exemption}
          onChange={(v) => set({ lta_exemption: v })}
        />
        <AmountInput
          label="Professional tax"
          path="salary.professional_tax"
          disabled={!isOld}
          value={salary.professional_tax}
          onChange={(v) => set({ professional_tax: v })}
        />
      </div>
      {isOld && (
        <SwitchField
          label="Rented home is in a metro city"
          description="Delhi, Mumbai, Kolkata or Chennai (50% HRA limit instead of 40%)"
          checked={salary.hra.is_metro}
          onChange={(v) => setHra({ is_metro: v })}
        />
      )}

      <ListSection
        title="Employers"
        hint="From your Form 16 Part A"
        itemLabel="Employer"
        addLabel="Add employer"
        items={salary.employers}
        onChange={(employers) => set({ employers })}
        createItem={emptyEmployer}
        renderItem={(employer, update, i) => (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <TextInput label="Employer name" path={`salary.employers.${i}.name`} required value={employer.name} onChange={(v) => update({ name: v })} />
            <TextInput
              label="TAN"
              path={`salary.employers.${i}.tan`}
              required
              uppercase
              maxLength={10}
              value={employer.tan}
              onChange={(v) => update({ tan: v })}
            />
            <AmountInput
              label="Income chargeable"
              path={`salary.employers.${i}.income_chargeable`}
              value={employer.income_chargeable}
              onChange={(v) => update({ income_chargeable: v })}
            />
            <AmountInput label="TDS deducted" path={`salary.employers.${i}.tds`} value={employer.tds} onChange={(v) => update({ tds: v })} />
            <TextInput
              label="Employer address"
              path={`salary.employers.${i}.address`}
              required={employerAddressRequired && i === 0}
              value={employer.address}
              onChange={(v) => update({ address: v })}
            />
            <TextInput
              label="City"
              path={`salary.employers.${i}.city`}
              required={employerAddressRequired && i === 0}
              value={employer.city}
              onChange={(v) => update({ city: v })}
            />
            <SelectField
              label="State"
              path={`salary.employers.${i}.state_code`}
              required={employerAddressRequired && i === 0}
              placeholder="Select…"
              value={employer.state_code}
              options={STATES.map((st) => ({ value: st.code, label: st.name }))}
              onChange={(v) => update({ state_code: v })}
            />
            <TextInput
              label="PIN code"
              path={`salary.employers.${i}.pin_code`}
              inputMode="numeric"
              maxLength={6}
              value={employer.pin_code}
              onChange={(v) => update({ pin_code: v })}
            />
          </div>
        )}
      />
    </SectionCard>
  );
}

import type { HomeLoan, HouseProperty, PropertyType } from "@/lib/itr/types";
import { AmountInput, GRID, ListSection, SectionCard, SelectField, TextInput } from "./fields";
import { STATES, emptyHouseProperty } from "./options";

const PROPERTY_TYPES: { value: PropertyType; label: string }[] = [
  { value: "self_occupied", label: "Self-occupied" },
  { value: "let_out", label: "Let out" },
  { value: "deemed_let_out", label: "Deemed let out" },
];

const LENDER_TYPES: { value: HomeLoan["lender_type"]; label: string }[] = [
  { value: "B", label: "Bank" },
  { value: "I", label: "Other" },
];

const STATE_OPTIONS = STATES.map((s) => ({ value: s.code, label: s.name }));

function PropertyFields({
  property,
  update,
  index,
}: {
  property: HouseProperty;
  update: (patch: Partial<HouseProperty>) => void;
  index: number;
}) {
  const p = `house_properties.${index}`;
  const setLoan = (patch: Partial<HomeLoan>) => update({ loan: { ...property.loan, ...patch } });
  const isRented = property.property_type !== "self_occupied";

  return (
    <div className="flex flex-col gap-4">
      <div className={GRID}>
        <SelectField
          label="Type"
          value={property.property_type}
          options={PROPERTY_TYPES}
          onChange={(v) => update({ property_type: v ?? "self_occupied" })}
        />
        <TextInput label="Address" path={`${p}.address`} required value={property.address} onChange={(v) => update({ address: v })} />
        <TextInput label="City" path={`${p}.city`} required value={property.city} onChange={(v) => update({ city: v })} />
        <SelectField
          label="State"
          path={`${p}.state_code`}
          required
          placeholder="Select…"
          value={property.state_code}
          options={STATE_OPTIONS}
          onChange={(v) => update({ state_code: v })}
        />
        <TextInput
          label="PIN code"
          inputMode="numeric"
          maxLength={6}
          value={property.pin_code}
          onChange={(v) => update({ pin_code: v })}
        />
        {isRented && (
          <>
            <AmountInput
              label="Gross rent received"
              path={`${p}.gross_rent`}
              required
              value={property.gross_rent}
              onChange={(v) => update({ gross_rent: v })}
            />
            <AmountInput
              label="Municipal tax paid"
              value={property.municipal_tax_paid}
              onChange={(v) => update({ municipal_tax_paid: v })}
            />
          </>
        )}
        <AmountInput
          label="Interest on home loan"
          value={property.interest_on_loan}
          onChange={(v) => update({ interest_on_loan: v })}
        />
      </div>

      {property.interest_on_loan > 0 && (
        <>
          <p className="text-xs uppercase tracking-wide text-muted">Loan details</p>
          <div className={GRID}>
            <SelectField
              label="Lender type"
              value={property.loan.lender_type}
              options={LENDER_TYPES}
              onChange={(v) => setLoan({ lender_type: v ?? "B" })}
            />
            <TextInput
              label="Lender name"
              required
              value={property.loan.lender_name}
              onChange={(v) => setLoan({ lender_name: v })}
            />
            <TextInput
              label="Loan account no."
              required
              value={property.loan.account_no}
              onChange={(v) => setLoan({ account_no: v })}
            />
            <TextInput
              label="Sanction date"
              required
              type="date"
              value={property.loan.sanction_date}
              onChange={(v) => setLoan({ sanction_date: v })}
            />
            <AmountInput
              label="Total loan amount"
              value={property.loan.total_amount}
              onChange={(v) => setLoan({ total_amount: v })}
            />
            <AmountInput
              label="Outstanding as on 31 Mar 2026"
              value={property.loan.outstanding_amount}
              onChange={(v) => setLoan({ outstanding_amount: v })}
            />
          </div>
        </>
      )}
    </div>
  );
}

export function HousePropertySection({
  properties,
  onChange,
}: {
  properties: HouseProperty[];
  onChange: (properties: HouseProperty[]) => void;
}) {
  return (
    <SectionCard title="House property" description="ITR-1 allows up to two house properties.">
      <ListSection
        title="Properties"
        itemLabel="Property"
        addLabel="Add property"
        max={2}
        items={properties}
        onChange={onChange}
        createItem={emptyHouseProperty}
        renderItem={(property, update, index) => <PropertyFields property={property} update={update} index={index} />}
      />
    </SectionCard>
  );
}

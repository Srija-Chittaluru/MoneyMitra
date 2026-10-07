import { Receipt, Wallet } from "lucide-react";
import type { ItrDraftData, TaxesPaid } from "@/lib/itr/types";
import { AmountInput, GRID, ListSection, SectionCard, SelectField, TextInput } from "./fields";
import { TDS_SECTIONS, emptyChallan, emptyTcs, emptyTdsOther } from "./options";

export function TaxesPaidStep({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  const taxes = draft.taxes_paid;
  const set = (patch: Partial<TaxesPaid>) => onChange({ ...draft, taxes_paid: { ...taxes, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        icon={Receipt}
        prefixes={["taxes_paid.tds_other"]}
        filled={taxes.tds_other.length > 0}
        title="TDS other than salary"
        description="Tax deducted by banks, tenants and others. Salary TDS goes with your employer in step 2."
      >
        <ListSection
          title="TDS entries"
          hint="From Form 26AS / Form 16A"
          itemLabel="Entry"
          addLabel="Add TDS"
          items={taxes.tds_other}
          onChange={(tds_other) => set({ tds_other })}
          createItem={emptyTdsOther}
          renderItem={(entry, update, i) => (
            <div className={GRID}>
              <TextInput
                label="Deductor name"
                path={`taxes_paid.tds_other.${i}.deductor_name`}
                required
                value={entry.deductor_name}
                onChange={(v) => update({ deductor_name: v })}
              />
              <TextInput label="TAN" path={`taxes_paid.tds_other.${i}.tan`} required uppercase maxLength={10} value={entry.tan} onChange={(v) => update({ tan: v })} />
              <SelectField
                label="Section"
                path={`taxes_paid.tds_other.${i}.section`}
                value={entry.section}
                options={TDS_SECTIONS}
                onChange={(v) => update({ section: v ?? "94A" })}
              />
              <AmountInput label="Amount paid / credited" path={`taxes_paid.tds_other.${i}.amount_paid`} value={entry.amount_paid} onChange={(v) => update({ amount_paid: v })} />
              <AmountInput label="TDS deducted" path={`taxes_paid.tds_other.${i}.tds_deducted`} value={entry.tds_deducted} onChange={(v) => update({ tds_deducted: v })} />
              <AmountInput label="TDS claimed this year" path={`taxes_paid.tds_other.${i}.tds_claimed`} value={entry.tds_claimed} onChange={(v) => update({ tds_claimed: v })} />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard
        title="TCS (tax collected at source)"
        icon={Receipt}
        prefixes={["taxes_paid.tcs"]}
        filled={taxes.tcs.length > 0}
      >
        <ListSection
          title="TCS entries"
          hint="From Form 26AS / Form 27D"
          itemLabel="Entry"
          addLabel="Add TCS"
          items={taxes.tcs}
          onChange={(tcs) => set({ tcs })}
          createItem={emptyTcs}
          renderItem={(entry, update) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="Collector name"
                required
                value={entry.collector_name}
                onChange={(v) => update({ collector_name: v })}
              />
              <TextInput label="TAN" required uppercase maxLength={10} value={entry.tan} onChange={(v) => update({ tan: v })} />
              <AmountInput
                label="Amount collected"
                value={entry.amount_collected}
                onChange={(v) => update({ amount_collected: v })}
              />
              <AmountInput
                label="Amount claimed"
                value={entry.amount_claimed}
                onChange={(v) => update({ amount_claimed: v })}
              />
            </div>
          )}
        />
      </SectionCard>

      <SectionCard
        title="Advance & self-assessment tax"
        icon={Wallet}
        prefixes={["taxes_paid.challans"]}
        filled={taxes.challans.length > 0}
        description="Tax you paid yourself through challans (Challan 280)."
      >
        <ListSection
          title="Challans"
          hint="Advance tax (paid by 31 Mar 2026) and self-assessment tax (paid after) are detected from the date"
          itemLabel="Challan"
          addLabel="Add challan"
          items={taxes.challans}
          onChange={(challans) => set({ challans })}
          createItem={emptyChallan}
          renderItem={(challan, update) => (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="BSR code"
                required
                inputMode="numeric"
                maxLength={7}
                value={challan.bsr_code}
                onChange={(v) => update({ bsr_code: v })}
              />
              <TextInput
                label="Date of deposit"
                required
                type="date"
                value={challan.date_of_deposit}
                onChange={(v) => update({ date_of_deposit: v })}
              />
              <TextInput
                label="Challan serial no."
                required
                inputMode="numeric"
                maxLength={5}
                value={challan.challan_serial_no}
                onChange={(v) => update({ challan_serial_no: v })}
              />
              <AmountInput label="Amount" value={challan.amount} onChange={(v) => update({ amount: v })} />
            </div>
          )}
        />
      </SectionCard>
    </div>
  );
}

import type { Address, Eligibility, ItrDraftData, PersonalInfo } from "@/lib/itr/types";
import { GRID, Notice, SectionCard, SelectField, TextInput, YesNo } from "./fields";
import { EMPLOYER_CATEGORIES, STATES } from "./options";

const DISQUALIFIERS: { key: Exclude<keyof Eligibility, "is_resident">; label: string }[] = [
  { key: "is_director", label: "Were you a director in a company at any time during the year?" },
  { key: "held_unlisted_shares", label: "Did you hold unlisted equity shares at any time during the year?" },
  { key: "has_foreign_assets_or_income", label: "Do you have any foreign assets, foreign income or signing authority abroad?" },
  { key: "has_capital_gains", label: "Do you have capital gains (shares, mutual funds, property) to report?" },
  { key: "has_business_income", label: "Do you have business or professional income?" },
  { key: "agricultural_income_above_5000", label: "Is your agricultural income more than ₹5,000?" },
  { key: "has_brought_forward_losses", label: "Do you have losses brought forward or to carry forward?" },
  { key: "tax_deferred_on_esop", label: "Have you deferred tax on ESOPs from an eligible start-up?" },
];

export function isItr1Ineligible(eligibility: Eligibility): boolean {
  return eligibility.is_resident === false || DISQUALIFIERS.some(({ key }) => eligibility[key]);
}

export function PersonalStep({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  const { eligibility, personal } = draft;
  const address = personal.address;

  const setEligibility = (patch: Partial<Eligibility>) =>
    onChange({ ...draft, eligibility: { ...eligibility, ...patch } });
  const setPersonal = (patch: Partial<PersonalInfo>) =>
    onChange({ ...draft, personal: { ...personal, ...patch } });
  const setAddress = (patch: Partial<Address>) => setPersonal({ address: { ...address, ...patch } });

  return (
    <div className="flex flex-col gap-6">
      <SectionCard
        title="Eligibility"
        description="ITR-1 (Sahaj) is for resident individuals with salary, up to two house properties and other sources income."
      >
        <div className="divide-y divide-border">
          <YesNo
            label="Were you a resident of India for FY 2025-26?"
            required
            value={eligibility.is_resident}
            onChange={(value) => setEligibility({ is_resident: value })}
          />
          {DISQUALIFIERS.map(({ key, label }) => (
            <YesNo
              key={key}
              label={label}
              value={eligibility[key]}
              onChange={(value) => setEligibility({ [key]: value })}
            />
          ))}
        </div>
        {isItr1Ineligible(eligibility) && (
          <Notice variant="warning" title="ITR-1 may not be right for you">
            Based on your answers you can&apos;t file ITR-1. Use the official Income Tax Department utility to file
            ITR-2 (or the form that applies to you) instead.
          </Notice>
        )}
      </SectionCard>

      <SectionCard title="Personal details" description="As they appear on your PAN card.">
        <div className={GRID}>
          <TextInput label="First name" path="personal.first_name" value={personal.first_name} onChange={(v) => setPersonal({ first_name: v })} />
          <TextInput label="Middle name" path="personal.middle_name" value={personal.middle_name} onChange={(v) => setPersonal({ middle_name: v })} />
          <TextInput label="Last name" path="personal.last_name" required value={personal.last_name} onChange={(v) => setPersonal({ last_name: v })} />
          <TextInput label="Father's name" path="personal.father_name" required value={personal.father_name} onChange={(v) => setPersonal({ father_name: v })} />
          <TextInput
            label="PAN"
            path="personal.pan"
            required
            uppercase
            maxLength={10}
            placeholder="ABCDE1234F"
            value={personal.pan}
            onChange={(v) => setPersonal({ pan: v })}
          />
          <TextInput
            label="Aadhaar number"
            path="personal.aadhaar"
            inputMode="numeric"
            maxLength={12}
            value={personal.aadhaar}
            onChange={(v) => setPersonal({ aadhaar: v })}
          />
          <TextInput
            label="Date of birth"
            path="personal.date_of_birth"
            required
            type="date"
            value={personal.date_of_birth}
            onChange={(v) => setPersonal({ date_of_birth: v })}
          />
          <TextInput
            label="Mobile"
            path="personal.mobile"
            required
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={personal.mobile}
            onChange={(v) => setPersonal({ mobile: v })}
          />
          <TextInput label="Email" path="personal.email" required type="email" value={personal.email} onChange={(v) => setPersonal({ email: v })} />
          <SelectField
            label="Employer category"
            path="personal.employer_category"
            required
            placeholder="Select…"
            value={personal.employer_category}
            options={EMPLOYER_CATEGORIES}
            onChange={(v) => setPersonal({ employer_category: v })}
          />
        </div>
      </SectionCard>

      <SectionCard title="Address">
        <div className={GRID}>
          <TextInput label="Flat / door no." path="personal.address.flat_no" required value={address.flat_no} onChange={(v) => setAddress({ flat_no: v })} />
          <TextInput label="Building / premises" path="personal.address.building" value={address.building} onChange={(v) => setAddress({ building: v })} />
          <TextInput label="Road / street" path="personal.address.street" value={address.street} onChange={(v) => setAddress({ street: v })} />
          <TextInput label="Area / locality" path="personal.address.locality" required value={address.locality} onChange={(v) => setAddress({ locality: v })} />
          <TextInput label="City / town" path="personal.address.city" required value={address.city} onChange={(v) => setAddress({ city: v })} />
          <SelectField
            label="State"
            path="personal.address.state_code"
            required
            placeholder="Select…"
            value={address.state_code}
            options={STATES.map((s) => ({ value: s.code, label: s.name }))}
            onChange={(v) => setAddress({ state_code: v })}
          />
          <TextInput
            label="PIN code"
            path="personal.address.pin_code"
            required
            inputMode="numeric"
            maxLength={6}
            value={address.pin_code}
            onChange={(v) => setAddress({ pin_code: v })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

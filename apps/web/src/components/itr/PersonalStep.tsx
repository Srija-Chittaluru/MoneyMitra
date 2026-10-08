import Link from "next/link";
import { Building2, FileUp, IdCard, Landmark, MapPin, UserRound, UserRoundCheck } from "lucide-react";
import type { Address, BankAccount, Eligibility, ItrDraftData, PersonalInfo } from "@/lib/itr/types";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  GRID,
  ListSection,
  Notice,
  SectionCard,
  SelectField,
  SwitchField,
  TextInput,
  YesNo,
  useSectionMode,
} from "./fields";
import { BANK_ACCOUNT_TYPES, EMPLOYER_CATEGORIES, STATES, emptyBankAccount } from "./options";

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

/** Entry point to auto-fill: documents today, Income Tax Department pre-fill once an ERI partner is connected. */
function PrefillCard() {
  const { onlyIssues } = useSectionMode();
  if (onlyIssues) return null;
  return (
    <Card className="flex flex-col gap-4 bg-card border-line p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-field">
          <FileUp className="h-4 w-4" />
        </span>
        <div>
          <p className="text-h2">Auto-fill from your documents</p>
          <p className="mt-1 text-sm text-muted">
            Upload your PAN, Form 16, AIS and payslips — details are filled in here automatically.
          </p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-2 sm:items-end">
        <Link
          href="/documents"
          className="inline-flex h-9 items-center justify-center rounded-md border border-line px-3 text-sm font-semibold text-foreground hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Upload documents
        </Link>
        <span className="flex items-center gap-2 text-sm text-muted">
          Fetch from Income Tax Dept
          <Badge variant="neutral" className="px-2 py-0.5 text-xs">
            Coming soon
          </Badge>
        </span>
      </div>
    </Card>
  );
}

function BankSection({ draft, onChange }: { draft: ItrDraftData; onChange: (draft: ItrDraftData) => void }) {
  const accounts = draft.bank_accounts;
  const refundCount = accounts.filter((a) => a.use_for_refund).length;

  function setAccounts(next: BankAccount[]) {
    // A single account receives the refund, so a new or only account is selected by default.
    if (next.length > 0 && !next.some((a) => a.use_for_refund)) {
      next = next.map((a, i) => (i === 0 ? { ...a, use_for_refund: true } : a));
    }
    onChange({ ...draft, bank_accounts: next });
  }

  function selectRefundAccount(index: number) {
    onChange({ ...draft, bank_accounts: accounts.map((a, i) => ({ ...a, use_for_refund: i === index })) });
  }

  return (
    <SectionCard
      title="Bank Details"
      icon={Landmark}
      prefixes={["bank_accounts"]}
      filled={accounts.length > 0}
      description="Add your bank accounts. The refund is paid into the one marked for refund — it must be pre-validated on the Income Tax portal."
    >
      <ListSection
        title="Bank accounts"
        itemLabel="Account"
        addLabel="Add account"
        items={accounts}
        onChange={setAccounts}
        createItem={emptyBankAccount}
        renderItem={(account, update, index) => (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <TextInput
                label="IFSC"
                required
                uppercase
                maxLength={11}
                value={account.ifsc}
                onChange={(v) => update({ ifsc: v })}
              />
              <TextInput label="Bank name" required value={account.bank_name} onChange={(v) => update({ bank_name: v })} />
              <TextInput
                label="Account no."
                required
                inputMode="numeric"
                value={account.account_no}
                onChange={(v) => update({ account_no: v })}
              />
              <SelectField
                label="Account type"
                value={account.account_type}
                options={BANK_ACCOUNT_TYPES}
                onChange={(v) => update({ account_type: v ?? "SB" })}
              />
            </div>
            <SwitchField
              label="Use for refund"
              checked={account.use_for_refund}
              onChange={(checked) => (checked ? selectRefundAccount(index) : update({ use_for_refund: false }))}
            />
          </div>
        )}
      />
      {accounts.length > 0 && refundCount !== 1 && (
        <p className="text-sm text-error">Select exactly one account to receive your refund.</p>
      )}
    </SectionCard>
  );
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
  const setPersonal = (patch: Partial<PersonalInfo>) => onChange({ ...draft, personal: { ...personal, ...patch } });
  const setAddress = (patch: Partial<Address>) => setPersonal({ address: { ...address, ...patch } });

  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Permanent Information"
        icon={UserRound}
        prefixes={[
          "personal.first_name",
          "personal.middle_name",
          "personal.last_name",
          "personal.date_of_birth",
          "personal.father_name",
        ]}
        filled={!!(personal.last_name && personal.date_of_birth && personal.father_name)}
        description="Please provide all info as per your government identity documents (PAN, Aadhaar etc.)"
        defaultOpen
      >
        <div className={GRID}>
          <TextInput
            label="First name"
            path="personal.first_name"
            value={personal.first_name}
            onChange={(v) => setPersonal({ first_name: v })}
          />
          <TextInput
            label="Middle name"
            path="personal.middle_name"
            value={personal.middle_name}
            onChange={(v) => setPersonal({ middle_name: v })}
          />
          <TextInput
            label="Last name"
            path="personal.last_name"
            required
            hint="As per PAN — its 5th character is the first letter of your last name"
            value={personal.last_name}
            onChange={(v) => setPersonal({ last_name: v })}
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
            label="Father's name"
            path="personal.father_name"
            required
            value={personal.father_name}
            onChange={(v) => setPersonal({ father_name: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Identification & Contact details"
        icon={IdCard}
        prefixes={["personal.pan", "personal.aadhaar", "personal.mobile", "personal.email"]}
        filled={!!(personal.pan && personal.mobile && personal.email)}
        description="To e-file your return, provide your PAN, Aadhaar and contact details."
      >
        <div className={GRID}>
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
            label="Mobile"
            path="personal.mobile"
            required
            type="tel"
            inputMode="numeric"
            maxLength={10}
            placeholder="10-digit mobile number"
            value={personal.mobile}
            onChange={(v) => setPersonal({ mobile: v })}
          />
          <TextInput
            label="Email"
            path="personal.email"
            required
            type="email"
            value={personal.email}
            onChange={(v) => setPersonal({ email: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Nature of Employment"
        icon={Building2}
        prefixes={["personal.employer_category"]}
        filled={!!personal.employer_category}
        description="The type of employer you worked for during the year."
      >
        <div className={GRID}>
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

      <SectionCard
        title="Your Address"
        icon={MapPin}
        prefixes={["personal.address"]}
        filled={!!(address.flat_no && address.city && address.state_code && address.pin_code)}
        description="You can provide either your current address or permanent address of residence."
      >
        <div className={GRID}>
          <TextInput
            label="Flat / door no."
            path="personal.address.flat_no"
            required
            value={address.flat_no}
            onChange={(v) => setAddress({ flat_no: v })}
          />
          <TextInput
            label="Building / premises"
            path="personal.address.building"
            value={address.building}
            onChange={(v) => setAddress({ building: v })}
          />
          <TextInput
            label="Road / street"
            path="personal.address.street"
            value={address.street}
            onChange={(v) => setAddress({ street: v })}
          />
          <TextInput
            label="Area / locality"
            path="personal.address.locality"
            required
            value={address.locality}
            onChange={(v) => setAddress({ locality: v })}
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
            label="City / town"
            path="personal.address.city"
            required
            value={address.city}
            onChange={(v) => setAddress({ city: v })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Residential Status"
        icon={UserRoundCheck}
        prefixes={["eligibility"]}
        filled={eligibility.is_resident !== null}
        description="Your residential status depends on the number of days you stayed in India. ITR-1 is for residents with salary, up to two house properties and other-sources income."
      >
        <div className="divide-y divide-line">
          <YesNo
            label="Were you a resident of India for FY 2025-26?"
            required
            value={eligibility.is_resident}
            onChange={(value) => setEligibility({ is_resident: value })}
          />
          {DISQUALIFIERS.map(({ key, label }) => (
            <YesNo key={key} label={label} value={eligibility[key]} onChange={(value) => setEligibility({ [key]: value })} />
          ))}
        </div>
        {isItr1Ineligible(eligibility) && (
          <Notice variant="warning" title="ITR-1 may not be right for you">
            Based on your answers you can&apos;t file ITR-1. Use the official Income Tax Department utility to file
            ITR-2 (or the form that applies to you) instead.
          </Notice>
        )}
      </SectionCard>

      <BankSection draft={draft} onChange={onChange} />

      <PrefillCard />
    </div>
  );
}

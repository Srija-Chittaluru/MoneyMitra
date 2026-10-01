import type { BankAccount, ItrDraftData, Regime } from "@/lib/itr/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { GRID, ListSection, Notice, SectionCard, SelectField, SwitchField, TextInput } from "./fields";
import { BANK_ACCOUNT_TYPES, emptyBankAccount } from "./options";

const REGIMES: { value: Regime; title: string; description: string }[] = [
  {
    value: "new",
    title: "New regime",
    description: "Lower slab rates and a ₹75,000 standard deduction, but almost no deductions or exemptions.",
  },
  {
    value: "old",
    title: "Old regime",
    description: "Higher slab rates, with HRA, LTA, 80C, 80D and other deductions allowed.",
  },
];

export function RegimeBankStep({
  draft,
  onChange,
  oldRegimeAllowed,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
  oldRegimeAllowed: boolean;
}) {
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
    onChange({
      ...draft,
      bank_accounts: accounts.map((a, i) => ({ ...a, use_for_refund: i === index })),
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <SectionCard title="Tax regime">
        <div className="grid gap-4 md:grid-cols-2">
          {REGIMES.map((regime) => {
            const selected = draft.regime === regime.value;
            const disabled = regime.value === "old" && !oldRegimeAllowed;
            return (
              <button
                key={regime.value}
                type="button"
                disabled={disabled}
                aria-pressed={selected}
                onClick={() => onChange({ ...draft, regime: regime.value })}
                className={cn(
                  "rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
                  selected && "ring-2 ring-accent",
                )}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="font-semibold text-foreground">{regime.title}</span>
                  {selected && <Badge variant="accent">Selected</Badge>}
                </div>
                <p className="text-sm text-muted">{regime.description}</p>
              </button>
            );
          })}
        </div>
        {!oldRegimeAllowed && (
          <Notice variant={draft.regime === "old" ? "warning" : "info"}>
            The due date (31 Jul 2026) has passed, so a belated return u/s 139(4) must use the new regime (CBDT
            rule).{draft.regime === "old" && " Select the new regime to continue."}
          </Notice>
        )}
      </SectionCard>

      <SectionCard title="Bank accounts" description="List all savings and current accounts you held during the year.">
        <ListSection
          title="Accounts"
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
                onChange={(checked) =>
                  checked ? selectRefundAccount(index) : update({ use_for_refund: false })
                }
              />
            </div>
          )}
        />
        {accounts.length > 0 && refundCount !== 1 && (
          <p className="text-sm text-error">Select exactly one account to receive your refund.</p>
        )}
      </SectionCard>

      <SectionCard title="Verification">
        <div className={GRID}>
          <TextInput
            label="Place"
            required
            hint="City where you're signing the verification"
            value={draft.verification_place}
            onChange={(v) => onChange({ ...draft, verification_place: v })}
          />
        </div>
      </SectionCard>
    </div>
  );
}

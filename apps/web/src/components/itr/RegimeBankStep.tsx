import { PenLine, Scale } from "lucide-react";
import type { ItrDraftData, ItrSummary, Regime } from "@/lib/itr/types";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import { GRID, Notice, SectionCard, TextInput } from "./fields";

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

/** Old vs new regime, with the tax each would cost so the user can pick. */
export function RegimeSection({
  draft,
  onChange,
  summary,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
  summary: ItrSummary | undefined;
}) {
  const oldRegimeAllowed = summary?.old_regime_allowed ?? true;
  const byRegime = Object.fromEntries(
    [summary?.selected, summary?.alternative].filter((r) => r != null).map((r) => [r.regime, r]),
  );
  const cheaper =
    byRegime.new && byRegime.old
      ? byRegime.new.total_tax_and_interest <= byRegime.old.total_tax_and_interest
        ? "new"
        : "old"
      : null;

  return (
    <SectionCard
      title="Choose your tax regime"
      icon={Scale}
      prefixes={["regime"]}
      filled
      description="We calculate your tax under both regimes. Pick the one that suits you."
      defaultOpen
    >
      <div className="grid gap-4 md:grid-cols-2">
        {REGIMES.map((regime) => {
          const selected = draft.regime === regime.value;
          const disabled = regime.value === "old" && !oldRegimeAllowed;
          const result = byRegime[regime.value];
          return (
            <button
              key={regime.value}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              onClick={() => onChange({ ...draft, regime: regime.value })}
              className={cn(
                "flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 text-left transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
                selected && "ring-2 ring-accent",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-semibold text-foreground">{regime.title}</span>
                <span className="flex gap-1">
                  {cheaper === regime.value && <Badge variant="success">Lower tax</Badge>}
                  {selected && <Badge variant="accent">Selected</Badge>}
                </span>
              </div>
              {result ? (
                <p className="font-mono text-xl font-semibold text-foreground">
                  {formatRupees(result.total_tax_and_interest)}
                  <span className="ml-2 font-sans text-sm font-normal text-muted">tax + interest</span>
                </p>
              ) : (
                disabled && <p className="text-sm text-muted">Not available after the due date</p>
              )}
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
  );
}

export function VerificationSection({
  draft,
  onChange,
}: {
  draft: ItrDraftData;
  onChange: (draft: ItrDraftData) => void;
}) {
  return (
    <SectionCard
      title="Verification"
      icon={PenLine}
      prefixes={["verification_place"]}
      filled={!!draft.verification_place}
      description="The place where you sign the declaration — usually your city."
    >
      <div className={GRID}>
        <TextInput
          label="Place"
          path="verification_place"
          required
          placeholder={draft.personal.address.city ?? "e.g. Pune"}
          value={draft.verification_place}
          onChange={(v) => onChange({ ...draft, verification_place: v })}
        />
      </div>
    </SectionCard>
  );
}

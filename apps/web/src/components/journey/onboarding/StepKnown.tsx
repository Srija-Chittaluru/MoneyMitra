import { Button } from "@/components/ui/Button";

/** Confirms a value MoneyMitra already knows (e.g. income from signup data) rather than asking fresh. */
export function StepKnown({
  value,
  source,
  onContinue,
  onUpdate,
}: {
  value: string;
  source: string;
  onContinue: () => void;
  onUpdate: () => void;
}) {
  return (
    <div className="flex max-w-lg flex-col gap-2 rounded-2xl border border-line bg-field p-6">
      <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.12em] text-success">
        <span className="h-1.5 w-1.5 rounded-full bg-success" />
        From your MoneyMitra data
      </div>
      <div className="mt-1 font-mono text-4xl font-medium tracking-tight text-foreground">{value}</div>
      <p className="text-sm text-muted">{source}</p>
      <p className="mt-3 text-base text-foreground">Is this still accurate?</p>
      <div className="mt-2 flex flex-wrap gap-2.5">
        <Button variant="primary" size="md" className="rounded-full" onClick={onContinue}>
          Yes, continue
        </Button>
        <Button variant="secondary" size="md" className="rounded-full" onClick={onUpdate}>
          Update
        </Button>
      </div>
    </div>
  );
}

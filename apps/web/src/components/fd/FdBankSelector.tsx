import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { FdRate } from "@/lib/fd-rates/types";

interface FdBankSelectorProps {
  /** One rate per bank for the chosen tenure; the list doubles as a table view of the chart. */
  rates: FdRate[];
  selected: ReadonlySet<string>;
  onToggle: (bankId: string) => void;
  onSelectAll: () => void;
  onClear: () => void;
}

export function FdBankSelector({ rates, selected, onToggle, onSelectAll, onClear }: FdBankSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <legend className="font-semibold text-foreground">Banks</legend>
        <span className="text-xs text-muted">
          {selected.size} of {rates.length} selected
        </span>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onSelectAll}>
          Select all
        </Button>
        <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClear}>
          Clear
        </Button>
      </div>
      <ul className="flex flex-col gap-1">
        {rates.map((rate) => {
          const checked = selected.has(rate.bank_id);
          return (
            <li key={rate.bank_id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-hover",
                  checked && "bg-field",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(rate.bank_id)}
                  className="h-4 w-4 shrink-0 accent-[var(--palette-signal-blue)] dark:accent-[var(--palette-lime-700)]"
                />
                <span className="min-w-0 flex-1 truncate text-foreground">{rate.bank_name}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{rate.annual_rate.toFixed(2)}%</span>
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

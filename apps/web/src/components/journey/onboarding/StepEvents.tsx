import { Select } from "@/components/ui/Select";
import { cn } from "@/lib/cn";

export interface EventChip {
  label: string;
  selected: boolean;
  onClick: () => void;
}

export interface EventRow {
  id: string;
  title: string;
  year: number;
  yearOptions: number[];
  onYearChange: (year: number) => void;
}

/** Toggle chips for life events, each adding a row with an approximate-year picker. */
export function StepEvents({ chips, rows }: { chips: EventChip[]; rows: EventRow[] }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2.5">
        {chips.map((c) => (
          <button
            key={c.label}
            type="button"
            onClick={c.onClick}
            className={cn(
              "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
              c.selected
                ? "border-[#3155E0] bg-[#3155E0]/10 text-foreground dark:border-[#7B9AFF] dark:bg-[#7B9AFF]/10"
                : "border-line bg-field text-foreground hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50",
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-field py-2.5 pl-4 pr-3"
        >
          <span className="min-w-[140px] flex-1 text-sm font-medium text-foreground">{row.title}</span>
          <span className="text-sm text-muted">Around</span>
          <Select
            value={row.year}
            onChange={(e) => row.onYearChange(Number(e.target.value))}
            className="h-10 w-auto"
          >
            {row.yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
        </div>
      ))}
    </div>
  );
}

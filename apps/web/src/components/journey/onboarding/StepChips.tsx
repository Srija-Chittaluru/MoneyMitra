import { cn } from "@/lib/cn";

export interface ChipOption {
  label: string;
  selected?: boolean;
  onClick: () => void;
}

/** A row of single- or multi-select pill buttons — used for the `stage` and `when` steps. */
export function StepChips({ options }: { options: ChipOption[] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={opt.onClick}
          className={cn(
            "h-11 rounded-full border px-4 text-sm font-medium transition-colors",
            opt.selected
              ? "border-[#3155E0] bg-[#3155E0]/10 text-foreground dark:border-[#7B9AFF] dark:bg-[#7B9AFF]/10"
              : "border-line bg-field text-foreground hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50",
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

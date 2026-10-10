import { cn } from "@/lib/cn";
import { cmp, fromS, toS } from "@/lib/journey/wizardLogic";

export interface SliderChip {
  label: string;
  onClick: () => void;
}

export interface SavedSubSlider {
  value: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}

/** A log-scaled money slider (small amounts get fine control, large amounts coarse) with optional quick-pick chips. */
export function StepSlider({
  value,
  range,
  unit,
  onChange,
  chips,
  saved,
}: {
  value: number | null;
  range: [number, number];
  unit?: string;
  onChange: (value: number) => void;
  chips?: SliderChip[];
  saved?: SavedSubSlider;
}) {
  const sliderPos = value != null ? toS(value, range) : toS(range[0], range);

  return (
    <div className="flex max-w-lg flex-col gap-4 rounded-2xl border border-line bg-field p-6">
      <div className="flex items-baseline gap-3">
        <div className="font-mono text-4xl font-medium tracking-tight text-foreground">
          {value != null ? cmp(value) : "Not set"}
        </div>
        {unit && <div className="text-sm text-muted">{unit}</div>}
      </div>
      <input
        type="range"
        min={0}
        max={1000}
        value={sliderPos}
        onChange={(e) => onChange(fromS(Number(e.target.value), range))}
        className="w-full accent-[#3155E0] dark:accent-[#7B9AFF]"
      />
      <div className="flex justify-between font-mono text-xs text-muted">
        <span>{cmp(range[0])}</span>
        <span>{cmp(range[1])}</span>
      </div>

      {chips && chips.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <button
              key={c.label}
              type="button"
              onClick={c.onClick}
              className="h-9 rounded-full border border-line bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50"
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      {saved && (
        <div className="flex flex-col gap-2 border-t border-line pt-4">
          <div className="flex justify-between gap-3 text-sm">
            <span className="text-muted">Already saved toward it?</span>
            <span className="font-mono text-foreground">{cmp(saved.value)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={saved.max}
            step={saved.step}
            value={saved.value}
            onChange={(e) => saved.onChange(Number(e.target.value))}
            className={cn("w-full accent-success")}
          />
        </div>
      )}
    </div>
  );
}

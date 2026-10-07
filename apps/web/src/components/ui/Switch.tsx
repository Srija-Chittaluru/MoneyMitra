import { cn } from "@/lib/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  label?: string;
  className?: string;
}

export function Switch({ checked, onCheckedChange, label, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        checked ? "bg-primary" : "border border-border bg-surface-muted",
        className,
      )}
    >
      <span
        className={cn(
          // The knob must contrast with its own track in both themes: `primary` is navy in
          // light mode but lime in dark mode, so a fixed lime knob vanished on the dark-mode track.
          "inline-block h-5 w-5 transform rounded-full transition-transform",
          checked ? "translate-x-6 bg-primary-foreground" : "translate-x-1 bg-muted",
        )}
      />
    </button>
  );
}

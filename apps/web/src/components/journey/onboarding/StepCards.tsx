export interface CardOption {
  label: string;
  sub?: string;
  onClick: () => void;
}

/** A grid of clickable cards — used for a goal's "kind" sub-question (e.g. car type) and the funding-by-loan step. */
export function StepCards({ cards }: { cards: CardOption[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {cards.map((c) => (
        <button
          key={c.label}
          type="button"
          onClick={c.onClick}
          className="flex flex-col gap-1 rounded-2xl border border-line bg-field p-4 text-left transition-colors hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50"
        >
          <span className="text-base font-semibold text-foreground">{c.label}</span>
          {c.sub && <span className="text-sm text-muted">{c.sub}</span>}
        </button>
      ))}
    </div>
  );
}

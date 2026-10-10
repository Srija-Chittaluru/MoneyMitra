import { tenureLabel } from "@/lib/fd-rates/types";
import type { FdRate } from "@/lib/fd-rates/types";

interface FdRateChartProps {
  /** One rate per selected bank, for the chosen tenure and customer category. */
  rates: FdRate[];
  isSample: boolean;
}

// One series, so one hue: signal blue on light, the darker lime step on dark
// (lime-500 is too light for a mark on the dark card). Validated for contrast
// against each theme's card; bank names inside the bars use ink-navy text,
// which reads at 4.5:1 or better on both.
const BAR = "bg-[var(--palette-signal-blue)] dark:bg-[var(--palette-lime-700)]";
const BAR_TEXT = "text-[var(--palette-ink-navy)]";

// Below this share of the axis, a bank name won't fit inside its bar and sits under it instead.
const NAME_INSIDE_MIN_SHARE = 0.45;

function formatRate(rate: number): string {
  return `${rate.toFixed(2).replace(/0$/, "")}%`;
}

/** Clean ticks every 2 percentage points, with headroom above the tallest bar for its label. */
function axisMax(rates: FdRate[]): number {
  const highest = Math.max(...rates.map((r) => r.annual_rate));
  return Math.max(2, Math.ceil((highest + 0.5) / 2) * 2);
}

function tickTop(tick: number, max: number): string {
  return `${(1 - tick / max) * 100}%`;
}

/**
 * A column chart of annual FD rates, highest first. Every bar carries its bank
 * and rate directly; hover or keyboard focus shows the details.
 */
export function FdRateChart({ rates, isSample }: FdRateChartProps) {
  const sorted = [...rates].sort((a, b) => b.annual_rate - a.annual_rate || a.bank_name.localeCompare(b.bank_name));
  const max = axisMax(sorted);
  const ticks = Array.from({ length: max / 2 + 1 }, (_, i) => max - i * 2);

  return (
    <div className="flex gap-3">
      {/* Y axis: labels and gridlines share one position formula, so they always line up */}
      <div className="relative h-72 w-9 shrink-0 text-right text-xs text-muted" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick} className="absolute right-0 -translate-y-1/2 leading-none" style={{ top: tickTop(tick, max) }}>
            {tick}%
          </span>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-x-auto pb-2">
        <div className="relative" style={{ minWidth: `${sorted.length * 3}rem` }}>
          {/* Gridlines */}
          <div className="pointer-events-none absolute inset-x-0 top-0 h-72" aria-hidden="true">
            {ticks.map((tick) => (
              <div
                key={tick}
                className={`absolute inset-x-0 border-t ${tick === 0 ? "border-border" : "border-dashed border-line"}`}
                style={{ top: tickTop(tick, max) }}
              />
            ))}
          </div>

          <ul className="relative flex h-72 items-end gap-0.5" aria-label="FD interest rate by bank">
            {sorted.map((rate, index) => {
              // Edge columns anchor their tooltip to that edge so it never spills out of the chart.
              const tooltipPosition =
                index === 0 ? "left-0" : index === sorted.length - 1 ? "right-0" : "left-1/2 -translate-x-1/2";
              const share = rate.annual_rate / max;
              const nameInside = share >= NAME_INSIDE_MIN_SHARE;
              const label = `${rate.bank_name}: ${formatRate(rate.annual_rate)} a year, ${tenureLabel(rate.tenure).toLowerCase()}`;
              return (
                <li key={rate.bank_id} className="group relative flex h-full min-w-[3rem] flex-1 flex-col items-center justify-end">
                  {/* Value on the cap */}
                  <span className="mb-1 text-xs font-semibold text-foreground">{formatRate(rate.annual_rate)}</span>
                  <button
                    type="button"
                    aria-label={label}
                    className={`${BAR} relative flex w-6 items-end justify-center rounded-t-[4px] transition-[filter] group-hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
                    style={{ height: `${share * 100}%` }}
                  >
                    {nameInside && (
                      <span
                        className={`${BAR_TEXT} rotate-180 whitespace-nowrap pt-2 text-xs font-medium [writing-mode:vertical-rl]`}
                        aria-hidden="true"
                      >
                        {rate.bank_name}
                      </span>
                    )}
                  </button>

                  {/* Tooltip: same details on hover and keyboard focus, inside the plot so it isn't clipped */}
                  <div
                    role="tooltip"
                    className={`pointer-events-none absolute top-0 z-10 hidden w-max max-w-[14rem] rounded-md border border-line bg-card-strong px-3 py-2 text-left text-xs text-foreground shadow-lg group-focus-within:block group-hover:block ${tooltipPosition}`}
                  >
                    <p className="font-semibold">{rate.bank_name}</p>
                    <p>{formatRate(rate.annual_rate)} a year</p>
                    <p className="text-muted">
                      {tenureLabel(rate.tenure)} · {rate.customer_category === "general" ? "General customers" : "Senior citizens"}
                    </p>
                    <p className="text-muted">
                      {isSample || !rate.effective_date ? "Sample rate, not a real offer" : `Effective ${rate.effective_date}`}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Names that didn't fit inside their bars */}
          {sorted.some((r) => r.annual_rate / max < NAME_INSIDE_MIN_SHARE) && (
            <div className="mt-1 flex gap-0.5" aria-hidden="true">
              {sorted.map((rate) => (
                <span key={rate.bank_id} className="min-w-[3rem] flex-1 truncate text-center text-xs text-muted">
                  {rate.annual_rate / max < NAME_INSIDE_MIN_SHARE ? rate.bank_name : ""}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

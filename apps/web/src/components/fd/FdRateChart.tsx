import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { monogram } from "@/lib/monogram";
import { tenureLabel } from "@/lib/fd-rates/types";
import type { FdRate } from "@/lib/fd-rates/types";

interface FdRateChartProps {
  /** One rate per selected bank, for the chosen tenure and customer category. Keep this short (≈5 or fewer) — more than that and standing bars stop being readable at a glance. */
  rates: FdRate[];
  isSample: boolean;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

// One series, one hue — same convention as the RD chart: signal blue on light,
// the darker lime step on dark (lime-500 is too light to read against a dark card).
const BAR = "bg-[var(--palette-signal-blue)] dark:bg-[var(--palette-lime-700)]";

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
 * A small, standing-bar comparison — deliberately capped to the banks the
 * caller passes in (keep that to a handful) so every bar, color and bank
 * name stays easy to read at a glance, instead of a dense wall of columns.
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
        <div className="relative" style={{ minWidth: `${Math.max(sorted.length * 6, 20)}rem` }}>
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

          <ul className="relative flex h-72 items-end justify-around gap-4" aria-label="FD interest rate by bank">
            {sorted.map((rate, index) => {
              const share = rate.annual_rate / max;
              const label = `${rate.bank_name}: ${formatRate(rate.annual_rate)} a year, ${tenureLabel(rate.tenure).toLowerCase()}`;
              return (
                <li key={rate.bank_id} className="group relative flex h-full w-24 flex-col items-center justify-end">
                  {index === 0 && sorted.length > 1 && (
                    <Badge variant="accent" className="absolute -top-1 px-1.5 py-0 text-[10px] leading-4">
                      Best
                    </Badge>
                  )}
                  {/* Value on the cap */}
                  <span className="mb-1.5 text-sm font-semibold text-foreground">{formatRate(rate.annual_rate)}</span>
                  <button
                    type="button"
                    aria-label={label}
                    className={`${BAR} relative w-9 rounded-full transition-[filter] group-hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring`}
                    style={{ height: `${share * 100}%` }}
                  />

                  {/* Tooltip: same details on hover and keyboard focus */}
                  <div
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-[14rem] -translate-x-1/2 rounded-md border border-line bg-card-strong px-3 py-2 text-left text-xs text-foreground shadow-lg group-focus-within:block group-hover:block"
                  >
                    <p className="font-semibold">{rate.bank_name}</p>
                    <p>{formatRate(rate.annual_rate)} a year</p>
                    <p className="text-muted">
                      {tenureLabel(rate.tenure)} · {rate.customer_category === "general" ? "General customers" : "Senior citizens"}
                    </p>
                    {isSample || !rate.effective_date ? (
                      <p className="text-muted">Sample rate, not a real offer</p>
                    ) : (
                      <p className="text-muted">Effective {dateFormat.format(new Date(rate.effective_date))}</p>
                    )}
                    {rate.source_url && !isSample && (
                      <a
                        href={rate.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-link hover:underline"
                      >
                        Source <ExternalLink className="h-3 w-3" aria-hidden="true" />
                      </a>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Bank identity below the baseline: avatar + name, never rotated or truncated-into-the-bar */}
          <div className="mt-2 flex justify-around gap-4" aria-hidden="true">
            {sorted.map((rate) => (
              <div key={rate.bank_id} className="flex w-24 flex-col items-center gap-1.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
                  {monogram(rate.bank_name)}
                </span>
                <span className="line-clamp-2 max-w-full text-center text-xs leading-tight text-muted">
                  {rate.bank_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

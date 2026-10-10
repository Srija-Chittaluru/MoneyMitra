import { Badge } from "@/components/ui/Badge";
import { formatRupees } from "@/lib/format";
import { monogram } from "@/lib/monogram";
import type { RdRate } from "@/lib/rd-rates/types";

export interface RdChartRow {
  rate: RdRate;
  total: number;
  interest: number;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

// One series, one hue — same convention as the FD chart: signal blue on light,
// the darker lime step on dark (lime-500 is too light to read against a dark card).
const BAR = "bg-[var(--palette-signal-blue)] dark:bg-[var(--palette-lime-700)]";

function formatRate(rate: number): string {
  return `${rate.toFixed(2).replace(/0$/, "")}%`;
}

/** Clean ticks every 1 percentage point, with headroom above the tallest bar for its label. */
function axisMax(rows: RdChartRow[]): number {
  return Math.ceil(Math.max(...rows.map((r) => r.rate.annual_rate)) + 0.5);
}

function tickTop(tick: number, max: number): string {
  return `${(1 - tick / max) * 100}%`;
}

/**
 * A small, standing-bar comparison — deliberately capped to the providers the
 * caller passes in (keep that to a handful) so every bar, avatar and name
 * stays easy to read at a glance, instead of a dense wall of columns.
 */
export function RdRateChart({ rows, months }: { rows: RdChartRow[]; months: number }) {
  const sorted = [...rows].sort(
    (a, b) => b.rate.annual_rate - a.rate.annual_rate || a.rate.provider_name.localeCompare(b.rate.provider_name),
  );
  const max = axisMax(sorted);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((t) => t % 2 === 0 || t === max);

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

          <ul className="relative flex h-72 items-end justify-around gap-4" aria-label="RD interest rate by provider">
            {sorted.map(({ rate, total, interest }, index) => {
              const share = rate.annual_rate / max;
              const label = `${rate.provider_name}: ${formatRate(rate.annual_rate)} a year, ${formatRupees(total)} at maturity`;
              return (
                <li key={rate.provider_id} className="group relative flex h-full w-24 flex-col items-center justify-end">
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
                    className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden w-max max-w-[16rem] -translate-x-1/2 rounded-md border border-line bg-card-strong px-3 py-2 text-left text-xs text-foreground shadow-lg group-focus-within:block group-hover:block"
                  >
                    <p className="font-semibold">{rate.provider_name}</p>
                    <p>{formatRate(rate.annual_rate)} a year</p>
                    <p>
                      {formatRupees(total)} after {months} months (+{formatRupees(interest)} interest)
                    </p>
                    <p className="text-muted">Effective {dateFormat.format(new Date(rate.effective_date))}</p>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Provider identity below the baseline: avatar + name, never rotated or truncated-into-the-bar */}
          <div className="mt-2 flex justify-around gap-4" aria-hidden="true">
            {sorted.map(({ rate }) => (
              <div key={rate.provider_id} className="flex w-24 flex-col items-center gap-1.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground shadow-sm">
                  {monogram(rate.provider_name)}
                </span>
                <span className="line-clamp-2 max-w-full text-center text-xs leading-tight text-muted">
                  {rate.provider_name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

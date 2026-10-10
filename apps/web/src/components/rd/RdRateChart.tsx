import { formatRupees } from "@/lib/format";
import type { RdRate } from "@/lib/rd-rates/types";

export interface RdChartRow {
  rate: RdRate;
  total: number;
  interest: number;
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

/** Ticks every 1 percentage point, with room past the highest bar for its label. */
function axisMax(rows: RdChartRow[]): number {
  return Math.ceil(Math.max(...rows.map((r) => r.rate.annual_rate)) + 0.5);
}

/**
 * Horizontal bars of each provider's RD rate, highest first, from zero. Every
 * bar carries its rate and maturity amount; hover or focus shows the details.
 */
export function RdRateChart({ rows, months }: { rows: RdChartRow[]; months: number }) {
  const max = axisMax(rows);
  const ticks = Array.from({ length: max + 1 }, (_, i) => i).filter((t) => t % 2 === 0 || t === max);

  return (
    <div>
      <ul className="flex flex-col gap-2" aria-label="RD interest rate by provider">
        {rows.map(({ rate, total, interest }, index) => (
          <li key={rate.provider_id} className="group relative grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]">
            <span className="truncate text-sm text-foreground" title={rate.provider_name}>
              {rate.provider_name}
            </span>
            <div className="relative flex h-7 items-center">
              {/* Gridlines */}
              {ticks.map((tick) => (
                <span
                  key={tick}
                  className="absolute inset-y-0 border-l border-dashed border-line"
                  style={{ left: `${(tick / max) * 100}%` }}
                  aria-hidden="true"
                />
              ))}
              <button
                type="button"
                aria-label={`${rate.provider_name}: ${rate.annual_rate.toFixed(2)}% a year, ${formatRupees(total)} at maturity`}
                className="relative h-5 rounded-r-[4px] bg-[var(--series-1)] transition-[filter] group-hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                style={{ width: `${(rate.annual_rate / max) * 100}%` }}
              />
              <span className="relative ml-2 whitespace-nowrap text-xs">
                <span className="font-semibold text-foreground">{rate.annual_rate.toFixed(2)}%</span>
                <span className="hidden text-muted sm:inline"> · {formatRupees(total)}</span>
              </span>

              {/* Tooltip: same details on hover and keyboard focus */}
              <div
                role="tooltip"
                className={`pointer-events-none absolute left-0 z-10 hidden w-max max-w-[16rem] rounded-md border border-line bg-card-strong px-3 py-2 text-xs text-foreground shadow-lg group-focus-within:block group-hover:block ${
                  index > rows.length - 3 ? "bottom-full mb-1" : "top-full mt-1"
                }`}
              >
                <p className="font-semibold">{rate.provider_name}</p>
                <p>{rate.annual_rate.toFixed(2)}% a year</p>
                <p>
                  {formatRupees(total)} after {months} months (+{formatRupees(interest)} interest)
                </p>
                <p className="text-muted">Effective {dateFormat.format(new Date(rate.effective_date))}</p>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* X axis */}
      <div className="mt-1 grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-3 sm:grid-cols-[12rem_minmax(0,1fr)]" aria-hidden="true">
        <span />
        <div className="relative h-4 text-xs text-muted">
          {ticks.map((tick) => (
            <span key={tick} className="absolute -translate-x-1/2" style={{ left: `${(tick / max) * 100}%` }}>
              {tick}%
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

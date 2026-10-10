"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { formatRupees } from "@/lib/format";
import type { Cap, NavPoint } from "@/lib/funds/types";

export const CAP_COLORS: Record<Cap, string> = {
  large: "var(--series-1)",
  mid: "var(--series-2)",
  small: "var(--series-3)",
};

const START_AMOUNT = 10_000;
const HEIGHT = 288;
const PAD = { top: 16, right: 92, bottom: 28, left: 64 };

/** One line on the chart: anything with a NAV history (a cap category, an ETF…). */
export interface GrowthSeries {
  id: string;
  label: string;
  color: string;
  history: NavPoint[];
}

interface Row {
  month: string; // YYYY-MM
  date: Date;
  values: Record<string, number | undefined>;
}

/** One row per month from `fromMonth`, with what ₹10,000 invested then became in each cap. */
function growthRows(series: GrowthSeries[], fromMonth: string): Row[] {
  const byMonth = new Map<string, Row>();
  for (const line of series) {
    const points = line.history.filter((p) => p.date.slice(0, 7) >= fromMonth);
    const base = points[0]?.nav;
    if (!base) continue;
    for (const point of points) {
      const month = point.date.slice(0, 7);
      const row = byMonth.get(month) ?? { month, date: new Date(point.date), values: {} };
      row.values[line.id] = Math.round((START_AMOUNT * point.nav) / base);
      byMonth.set(month, row);
    }
  }
  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}

function niceTicks(min: number, max: number, count = 4): number[] {
  const step = Math.pow(10, Math.floor(Math.log10((max - min) / count)));
  const nice = [1, 2, 2.5, 5, 10].map((m) => m * step).find((s) => (max - min) / s <= count) ?? step * 10;
  const ticks = [];
  for (let t = Math.floor(min / nice) * nice; t <= max + nice / 2; t += nice) ticks.push(t);
  return ticks;
}

const monthFormat = new Intl.DateTimeFormat("en-IN", { month: "short", year: "numeric" });

interface GrowthChartProps {
  series: GrowthSeries[];
  /** First month shown, YYYY-MM; ₹10,000 is invested in every cap at this month's NAV. */
  fromMonth: string;
}

/**
 * Growth of ₹10,000, one line per series. Lines carry their name and end value
 * directly; hovering shows every series' value for a month.
 */
export function GrowthChart({ series, fromMonth }: GrowthChartProps) {
  const wrapper = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const node = wrapper.current;
    if (!node) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const rows = useMemo(() => growthRows(series, fromMonth), [series, fromMonth]);
  if (rows.length < 2) return null;

  const values = rows.flatMap((r) => Object.values(r.values).filter((v): v is number => v !== undefined));
  const ticks = niceTicks(Math.min(...values, START_AMOUNT), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const t0 = rows[0].date.getTime();
  const t1 = rows[rows.length - 1].date.getTime();
  const plotW = width - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (d: Date) => PAD.left + ((d.getTime() - t0) / (t1 - t0)) * plotW;
  const y = (v: number) => PAD.top + (1 - (v - yMin) / (yMax - yMin)) * plotH;

  const xTicks = rows.filter((_, i) => i === 0 || i === rows.length - 1 || i % Math.ceil(rows.length / 5) === 0);

  // End labels: ordered by value, nudged apart so they never overlap.
  const ends = series
    .map((c) => {
      const last = [...rows].reverse().find((r) => r.values[c.id] !== undefined);
      return last ? { category: c, value: last.values[c.id]!, y: y(last.values[c.id]!) } : null;
    })
    .filter((e): e is NonNullable<typeof e> => e !== null)
    .sort((a, b) => a.y - b.y);
  for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 30);

  function onMove(event: PointerEvent<SVGRectElement>) {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const target = t0 + ratio * (t1 - t0);
    let best = 0;
    rows.forEach((r, i) => {
      if (Math.abs(r.date.getTime() - target) < Math.abs(rows[best].date.getTime() - target)) best = i;
    });
    setHover(best);
  }

  const hovered = hover !== null ? rows[hover] : null;

  return (
    <div ref={wrapper} className="relative w-full">
      <svg width={width} height={HEIGHT} role="img" aria-label={`Growth of ₹10,000 invested in ${monthFormat.format(rows[0].date)}, `}>
        {/* Recessive grid and y axis */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--line)"
              strokeDasharray={tick === START_AMOUNT ? undefined : "3 3"}
            />
            <text x={PAD.left - 8} y={y(tick)} dy="0.32em" textAnchor="end" className="fill-[var(--text-muted)] text-[11px]">
              {formatRupees(tick)}
            </text>
          </g>
        ))}
        {xTicks.map((row) => (
          <text key={row.month} x={x(row.date)} y={HEIGHT - 8} textAnchor="middle" className="fill-[var(--text-muted)] text-[11px]">
            {monthFormat.format(row.date)}
          </text>
        ))}

        {/* One 2px line per cap */}
        {series.map((c) => {
          const path = rows
            .filter((r) => r.values[c.id] !== undefined)
            .map((r, i) => `${i === 0 ? "M" : "L"}${x(r.date).toFixed(1)},${y(r.values[c.id]!).toFixed(1)}`)
            .join(" ");
          return <path key={c.id} d={path} fill="none" stroke={c.color} strokeWidth={2} strokeLinejoin="round" />;
        })}

        {/* Direct labels at the line ends, in text ink with a colour key */}
        {ends.map(({ category, value, y: labelY }) => (
          <g key={category.id} transform={`translate(${width - PAD.right + 8}, ${labelY})`}>
            <rect x={0} y={-5} width={10} height={3} rx={1.5} fill={category.color} />
            <text x={14} y={0} dy="0.1em" className="fill-[var(--text-primary)] text-[11px] font-semibold">
              {category.label}
            </text>
            <text x={14} y={13} className="fill-[var(--text-muted)] text-[11px]">
              {formatRupees(value)}
            </text>
          </g>
        ))}

        {/* Crosshair */}
        {hovered && (
          <g pointerEvents="none">
            <line x1={x(hovered.date)} x2={x(hovered.date)} y1={PAD.top} y2={HEIGHT - PAD.bottom} stroke="var(--text-muted)" strokeWidth={1} />
            {series.map((c) =>
              hovered.values[c.id] !== undefined ? (
                <circle
                  key={c.id}
                  cx={x(hovered.date)}
                  cy={y(hovered.values[c.id]!)}
                  r={4}
                  fill={c.color}
                  stroke="var(--card-bg-strong)"
                  strokeWidth={2}
                />
              ) : null,
            )}
          </g>
        )}

        <rect
          x={PAD.left}
          y={PAD.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hovered && (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-2 z-10 w-max rounded-md border border-line bg-card-strong px-3 py-2 text-xs text-foreground shadow-lg"
          style={
            x(hovered.date) > width / 2
              ? { right: width - x(hovered.date) + 12 }
              : { left: x(hovered.date) + 12 }
          }
        >
          <p className="mb-1 font-semibold">{monthFormat.format(hovered.date)}</p>
          {series.map((c) =>
            hovered.values[c.id] !== undefined ? (
              <p key={c.id} className="flex items-center gap-2">
                <span className="h-0.5 w-3 rounded-full" style={{ background: c.color }} />
                <span className="text-muted">{c.label}</span>
                <span className="ml-auto pl-3 font-mono">{formatRupees(hovered.values[c.id]!)}</span>
              </p>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}

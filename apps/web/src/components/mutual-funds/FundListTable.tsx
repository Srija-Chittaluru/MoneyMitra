"use client";

import { useState } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { cn } from "@/lib/cn";
import type { FundList, FundReturnsRow } from "@/lib/funds/types";

type SortKey = "one_year" | "three_year" | "five_year";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "one_year", label: "1Y (%)" },
  { key: "three_year", label: "3Y (%)" },
  { key: "five_year", label: "5Y (%)" },
];

const TOP = 10;

function formatPercent(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

function sortRows(rows: FundReturnsRow[], key: SortKey): FundReturnsRow[] {
  // Funds without the period (too young) go last.
  return [...rows].sort((a, b) => (a[key] === null ? 1 : 0) - (b[key] === null ? 1 : 0) || (b[key] ?? 0) - (a[key] ?? 0));
}

const dateFormat = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

interface FundListTableProps {
  lists: FundList[];
  /** The list to open on, e.g. the cap that suits the user. */
  initial: string;
  asOf: string;
  title: string;
  subtitle: string;
}

/**
 * Every Direct-Growth fund in each category with its 1, 3 and 5-year returns
 * and the category average, like a fund screener. Columns sort on click.
 */
export function FundListTable({ lists, initial, asOf, title, subtitle }: FundListTableProps) {
  const [activeId, setActiveId] = useState(initial);
  const [sortKey, setSortKey] = useState<SortKey>("three_year");
  const [showAll, setShowAll] = useState(false);

  const active = lists.find((l) => l.id === activeId) ?? lists[0];
  const rows = sortRows(active.funds, sortKey);
  const shown = showAll ? rows : rows.slice(0, TOP);
  const labels = lists.map((l) => l.label);

  return (
    <Card className="min-w-0 border-line bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h3 className="text-h2">{title}</h3>
          <p className="text-sm text-muted">
            {subtitle} · returns a year, compounded · NAVs as of {dateFormat.format(new Date(asOf))}
          </p>
        </div>
        <SegmentedControl
          options={labels}
          value={active.label}
          onChange={(label) => {
            setActiveId(lists.find((l) => l.label === label)!.id);
            setShowAll(false);
          }}
          className="max-w-full overflow-x-auto"
        />
      </div>

      {active.note && <p className="mb-3 rounded-md bg-surface-muted px-3 py-2 text-sm text-muted">{active.note}</p>}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[32rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              <th scope="col" className="py-3 pr-4 font-semibold text-foreground">
                Scheme name
              </th>
              {COLUMNS.map((column) => (
                <th key={column.key} scope="col" className="w-24 py-3 text-right font-semibold" aria-sort={sortKey === column.key ? "descending" : "none"}>
                  <button
                    type="button"
                    onClick={() => setSortKey(column.key)}
                    className={cn(
                      "inline-flex items-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
                      sortKey === column.key ? "text-foreground" : "text-muted hover:text-foreground",
                    )}
                  >
                    {column.label}
                    {sortKey === column.key && <ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-line bg-surface-muted">
              <th scope="row" className="py-3 pl-2 pr-4 text-left font-semibold text-accent-text">
                Category average
              </th>
              {COLUMNS.map((column) => (
                <td key={column.key} className="py-3 pr-2 text-right font-mono font-semibold text-foreground">
                  {formatPercent(active.average[column.key])}
                </td>
              ))}
            </tr>
            {shown.map((fund) => (
              <tr key={fund.scheme_code} className="border-b border-line last:border-0 hover:bg-hover">
                <th scope="row" className="py-3 pr-4 text-left font-medium text-foreground">
                  {fund.name}
                </th>
                {COLUMNS.map((column) => {
                  const value = fund[column.key];
                  const beats = value !== null && active.average[column.key] !== null && value > active.average[column.key]!;
                  return (
                    <td key={column.key} className={cn("py-3 pr-2 text-right font-mono", beats ? "text-foreground" : "text-muted")}>
                      {formatPercent(value)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {rows.length > TOP && (
        <div className="mt-3 flex justify-center">
          <Button variant="ghost" size="sm" onClick={() => setShowAll((v) => !v)}>
            {showAll ? `Show top ${TOP}` : `Show all ${rows.length} funds`}
          </Button>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">
        Returns above the category average are in darker text. Ranked by past returns only; this is not a
        recommendation to buy any fund. &quot;—&quot; means the fund is younger than that period.
      </p>
    </Card>
  );
}

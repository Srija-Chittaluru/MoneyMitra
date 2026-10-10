"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import { ChartCandlestick, ChartPie, Clock, Landmark, Repeat, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { EtfComparison } from "@/components/etf/EtfComparison";
import { FdComparison } from "@/components/fd/FdComparison";
import { MutualFundComparison } from "@/components/mutual-funds/MutualFundComparison";
import { RdComparison } from "@/components/rd/RdComparison";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { RecommendationsView } from "./RecommendationsView";

type CategoryId = "personalized" | "fd" | "rd" | "mutual-funds" | "etf";

interface Category {
  id: CategoryId;
  label: string;
  icon: LucideIcon;
  /** A category without a comparison yet describes what is coming, with no data. */
  comingSoon?: { title: string; description: string };
}

const CATEGORIES: readonly Category[] = [
  { id: "personalized", label: "Personalized Recommendations", icon: Sparkles },
  { id: "fd", label: "Fixed Deposits (FDs)", icon: Landmark },
  {
    id: "rd",
    label: "Recurring Deposits (RDs)",
    icon: Repeat,
  },
  {
    id: "mutual-funds",
    label: "Mutual Funds",
    icon: ChartPie,
  },
  {
    id: "etf",
    label: "Exchange-Traded Funds (ETFs)",
    icon: ChartCandlestick,
  },
];

function ComingSoon({ category }: { category: Category & { comingSoon: NonNullable<Category["comingSoon"]> } }) {
  const Icon = category.icon;
  return (
    <Card className="flex flex-col items-center gap-3 border-dashed border-line bg-card px-6 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="h-6 w-6 text-muted" strokeWidth={1.5} />
      </span>
      <Badge variant="neutral" className="gap-1.5">
        <Clock className="h-3.5 w-3.5" />
        Coming soon
      </Badge>
      <h3 className="text-h2">{category.comingSoon.title}</h3>
      <p className="max-w-md text-sm text-muted">{category.comingSoon.description}</p>
      <p className="text-xs text-muted">Other categories already have comparisons.</p>
    </Card>
  );
}

/**
 * The Recommendations page, one category at a time: the personalized
 * recommendations first, then savings and investment comparisons. A tab list
 * (WAI-ARIA tabs pattern): arrow keys, Home and End move between categories,
 * and the content below switches without leaving the page.
 */
export function ProductCategories() {
  // Personalized Recommendations opens by default; `#fd` (where the old /fd-comparison
  // route redirects) opens the FD comparison and `#mutual-funds` the mutual funds. Read once on mount: AppShell renders this
  // only in the browser, after the session is known, so there's no server render to mismatch.
  const [active, setActive] = useState<CategoryId>(() => {
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    const byHash: Record<string, CategoryId> = { "#fd": "fd", "#rd": "rd", "#mutual-funds": "mutual-funds", "#etf": "etf" };
    return byHash[hash] ?? "personalized";
  });
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  function select(index: number) {
    const category = CATEGORIES[(index + CATEGORIES.length) % CATEGORIES.length];
    setActive(category.id);
    const tab = tabs.current[CATEGORIES.indexOf(category)];
    tab?.focus();
    tab?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const moves: Record<string, number> = {
      ArrowRight: index + 1,
      ArrowLeft: index - 1,
      Home: 0,
      End: CATEGORIES.length - 1,
    };
    if (event.key in moves) {
      event.preventDefault();
      select(moves[event.key]);
    }
  }

  return (
    <section>

      <div className="mb-6 overflow-x-auto border-b border-line">
        <div role="tablist" aria-label="Recommendation categories" className="flex min-w-max gap-1">
          {CATEGORIES.map((category, index) => {
            const selected = category.id === active;
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                ref={(node) => {
                  tabs.current[index] = node;
                }}
                type="button"
                role="tab"
                id={`category-tab-${category.id}`}
                aria-selected={selected}
                aria-controls={`category-panel-${category.id}`}
                tabIndex={selected ? 0 : -1}
                onClick={() => setActive(category.id)}
                onKeyDown={(event) => onKeyDown(event, index)}
                className={cn(
                  "relative flex items-center gap-2 whitespace-nowrap rounded-t-md px-4 py-3 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring",
                  selected ? "bg-surface-muted text-foreground" : "text-muted hover:bg-hover hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={selected ? 2 : 1.5} aria-hidden="true" />
                {category.label}
                {category.comingSoon && (
                  <span className="rounded-full border border-line px-2 py-0.5 text-xs font-medium text-muted">Soon</span>
                )}
                {/* The active indicator is a filled bar, not a border: a global unlayered
                    `* { border-color }` rule in globals.css overrides border-color utilities. */}
                {selected && (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" aria-hidden="true" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Every panel stays mounted (inactive ones hidden), so recommendations and FD selections survive a switch. */}
      {CATEGORIES.map((category) => (
        <div
          key={category.id}
          role="tabpanel"
          id={`category-panel-${category.id}`}
          aria-labelledby={`category-tab-${category.id}`}
          hidden={category.id !== active}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {category.id === "personalized" ? (
            <RecommendationsView />
          ) : category.comingSoon ? (
            <ComingSoon category={category as Category & { comingSoon: NonNullable<Category["comingSoon"]> }} />
          ) : category.id === "rd" ? (
            <RdComparison />
          ) : category.id === "etf" ? (
            <EtfComparison />
          ) : category.id === "mutual-funds" ? (
            <MutualFundComparison />
          ) : (
            <FdComparison />
          )}
        </div>
      ))}
    </section>
  );
}

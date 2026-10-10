import { CheckCircle2, FileStack, LayoutDashboard, Scale, Sparkles, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import { Avatar } from "@/components/ui/Avatar";
import { DASHBOARD_RECOMMENDATIONS, TAX, inr } from "./demo-data";
import { Amount, PhotoBackground, RegimeBars, WindowFrame } from "./parts";

const RAIL_ICONS = [LayoutDashboard, FileStack, Scale, Sparkles, Wallet];

const CATEGORY_ICON: Record<(typeof DASHBOARD_RECOMMENDATIONS)[number]["category"], LucideIcon> = {
  tax_saving: Scale,
  life_stage: Sparkles,
};

function MiniStat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div data-reveal className="min-w-0 rounded-md border border-line bg-field p-2.5 sm:p-3">
      <span className="mb-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/10">
        <Icon className="h-2.5 w-2.5 text-accent-text" strokeWidth={2} />
      </span>
      <p className="truncate text-[10px] text-muted sm:text-[11px]">{label}</p>
      <Amount className="mt-0.5 block truncate text-[13px] text-foreground sm:text-base">{value}</Amount>
    </div>
  );
}

/**
 * Hero visual: an at-a-glance dashboard matching the real app's Dashboard
 * page — same 3 stats (annual income, estimated tax, potential savings,
 * same icons), a regime-comparison snippet and real recommendation
 * categories. Static demo data only, not an invented budgeting app.
 */
export function ProductMockup() {
  return (
    <div data-reveal className="relative pb-10 lg:pb-16 lg:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-8 -z-10 h-3/4 rounded-full bg-accent/10 blur-3xl"
      />

      <WindowFrame title="MoneyMitra · Dashboard">
        <div
          role="img"
          aria-label="Demo dashboard: a welcome heading, annual income, estimated tax and potential savings, an old vs new regime comparison, and a recommendation"
          className="flex"
        >
          <div
            aria-hidden
            className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-line bg-field py-4 sm:flex"
          >
            {RAIL_ICONS.map((Icon, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md",
                  i === 0 ? "bg-card text-foreground shadow-[0_0_0_1px_var(--line)]" : "text-muted",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
            <span className="flex-1" />
            <Avatar initial="A" size="sm" className="rounded-full bg-accent text-accent-foreground" />
          </div>

          <div aria-hidden className="relative isolate min-w-0 flex-1 space-y-4 overflow-hidden p-3.5 sm:p-5">
            <PhotoBackground
              src="/landing/pixel-sky.png"
              objectPosition="50% 100%"
              sizes="800px"
              className="hidden -z-10 dark:block"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-r from-background/85 via-background/55 to-background/85"
            />
            <p className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">Welcome back, Aditya</p>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <MiniStat icon={Wallet} label="Annual income" value={inr(TAX.gross)} />
              <MiniStat icon={Scale} label="Estimated tax" value={inr(TAX.oldRegime.total)} />
              <MiniStat icon={Sparkles} label="Potential savings" value={inr(TAX.potentialSavings)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div data-reveal className="rounded-md border border-line bg-field p-3.5">
                <p className="mb-2 text-xs font-semibold text-foreground">Old vs. new regime</p>
                <RegimeBars />
              </div>

              <div data-reveal data-float="a" className="rounded-md border border-accent/40 bg-field p-3.5">
                <p className="mb-2 text-xs font-semibold text-foreground">Recommendations for you</p>
                <ul className="flex flex-col gap-2.5">
                  {DASHBOARD_RECOMMENDATIONS.map((rec) => {
                    const Icon = CATEGORY_ICON[rec.category];
                    return (
                      <li key={rec.title} className="flex items-start gap-2">
                        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-accent/15">
                          <Icon className="h-2.5 w-2.5 text-accent-text" strokeWidth={2} />
                        </span>
                        <span className="min-w-0 truncate text-[11px] text-foreground">{rec.title}</span>
                      </li>
                    );
                  })}
                  <li className="flex items-center gap-2 text-[11px] text-link">
                    <CheckCircle2 className="h-3 w-3 shrink-0" strokeWidth={2} />
                    View all recommendations
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

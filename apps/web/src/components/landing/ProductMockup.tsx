import {
  CheckCircle2,
  FileText,
  LayoutDashboard,
  Scale,
  Sparkles,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { TAX, inr } from "./demo-data";
import { Amount, Pill, RegimeBars, WindowFrame } from "./parts";

const RAIL_ICONS = [LayoutDashboard, Scale, FileText, Sparkles, Wallet];

function MiniStat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-md border border-border p-2.5 sm:p-3",
        highlight ? "bg-surface-muted" : "bg-surface",
      )}
    >
      <p className="truncate text-[10px] text-muted sm:text-[11px]">{label}</p>
      <Amount className="mt-1 block truncate text-[13px] text-foreground sm:text-base">
        {value}
      </Amount>
    </div>
  );
}

/** Hero visual: an at-a-glance dashboard. Static demo data only. */
export function ProductMockup() {
  return (
    <div className="relative pb-10 lg:pb-16 lg:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-8 -z-10 h-3/4 rounded-full bg-link/10 blur-3xl"
      />

      <WindowFrame title="MoneyMitra · Overview">
        <div
          role="img"
          aria-label="Demo dashboard showing an old versus new tax regime comparison, document extraction status, and a tax-saving recommendation"
          className="flex"
        >
          <div
            aria-hidden
            className="hidden w-14 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-surface-muted py-4 sm:flex"
          >
            {RAIL_ICONS.map((Icon, i) => (
              <span
                key={i}
                className={cn(
                  "flex h-9 w-9 items-center justify-center rounded-md",
                  i === 0
                    ? "bg-surface text-foreground shadow-[0_0_0_1px_var(--border)]"
                    : "text-muted",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={1.75} />
              </span>
            ))}
          </div>

          <div aria-hidden className="min-w-0 flex-1 space-y-3 p-3.5 sm:space-y-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-foreground sm:text-base">
                  Tax overview
                </p>
                <p className="text-[11px] text-muted">
                  {TAX.year} · Salaried
                </p>
              </div>
              <Pill tone="neutral">Updated just now</Pill>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <MiniStat label="Annual income" value={inr(TAX.gross)} />
              <MiniStat label="Estimated tax" value={inr(TAX.newRegime.total)} />
              <MiniStat label="You could save" value={inr(TAX.savings)} highlight />
            </div>

            <div className="grid gap-3 sm:gap-4 md:grid-cols-5">
              <div className="rounded-md border border-border p-3.5 md:col-span-3">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">
                    Old vs. new regime
                  </p>
                  <Scale className="h-3.5 w-3.5 text-muted" strokeWidth={1.75} />
                </div>
                <RegimeBars />
              </div>

              <div className="rounded-md border border-border p-3.5 md:col-span-2">
                <p className="mb-2.5 text-xs font-semibold text-foreground">
                  Documents
                </p>
                <ul className="flex flex-col gap-2.5 text-[11px]">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="truncate text-foreground">Form 16</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-success" />
                    <span className="truncate text-foreground">Payslips 12/12</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="h-3.5 w-3.5 shrink-0 rounded-full border border-warning" />
                    <span className="truncate text-muted">Rent receipts</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>

      {/* Floating callouts — desktop only, so small screens never overflow */}
      <div
        aria-hidden
        className="absolute -left-6 bottom-0 hidden w-72 items-start gap-3 rounded-lg border border-border bg-surface p-3.5 shadow-[0_18px_40px_-18px_rgba(11,15,20,0.35)] lg:flex"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-surface-muted text-link">
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">
            Stay on the new regime
          </p>
          <p className="mt-0.5 text-[11px] leading-4 text-muted">
            Saves an estimated {inr(TAX.savings)} based on your documents.
          </p>
        </div>
      </div>

      <div
        aria-hidden
        className="absolute right-6 top-0 hidden items-center gap-2 rounded-full border border-border bg-surface px-3 py-1.5 text-[11px] font-medium text-foreground shadow-[0_12px_28px_-14px_rgba(11,15,20,0.35)] lg:flex"
      >
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        Form 16 extracted
      </div>
    </div>
  );
}

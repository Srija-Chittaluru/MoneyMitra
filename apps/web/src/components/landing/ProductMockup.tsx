import { LayoutDashboard, FileText, Scale, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { MONEY, TAX, inr } from "./demo-data";
import { Amount, WindowFrame } from "./parts";

const RAIL_ICONS = [LayoutDashboard, Scale, FileText, Sparkles, Wallet];

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div data-reveal className="min-w-0 rounded-md border border-line bg-field p-2.5 sm:p-3">
      <p className="truncate text-[10px] text-muted sm:text-[11px]">{label}</p>
      <Amount className="mt-1 block truncate text-[13px] text-foreground sm:text-base">{value}</Amount>
    </div>
  );
}

const NEXT_MOVE_STEPS = [
  { label: "Invest ₹50,000 in NPS", detail: "Section 80CCD(1B)", saved: "−₹15,600", done: true },
  { label: "Add parents' health cover", detail: "Section 80D · ₹9,000 premium", saved: "−₹2,800", done: false },
  { label: "Put ₹10,000/month toward your emergency fund", detail: "Reaches 6 months by March 2027", saved: "", done: false },
];

/** Hero visual: an at-a-glance dashboard, matching the real app's Dashboard page. Static demo data only. */
export function ProductMockup() {
  return (
    <div data-reveal className="relative pb-10 lg:pb-16 lg:pt-6">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-8 -z-10 h-3/4 rounded-full bg-accent/10 blur-3xl"
      />

      <WindowFrame title="MoneyMitra · Overview">
        <div
          role="img"
          aria-label="Demo dashboard: a morning greeting, this month's available balance, a ranked next-move recommendation worth ₹18,400 in tax savings, and a tax snapshot"
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
          </div>

          <div aria-hidden className="min-w-0 flex-1 space-y-4 p-3.5 sm:p-5">
            <div>
              <p className="font-mono text-[10px] tracking-wide text-muted">TUESDAY, 6 OCTOBER</p>
              <p className="mt-1 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Good morning, Aditya
              </p>
              <p className="mt-0.5 text-xs text-muted sm:text-sm">Here&apos;s what needs your attention.</p>
            </div>

            <div>
              <p className="text-[11px] text-muted">Available this month</p>
              <Amount className="mt-1 block text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                {inr(MONEY.available)}
              </Amount>
              <p className="mt-0.5 text-[11px] text-muted">After rent, EMI and your regular spending</p>
            </div>

            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <MiniStat label="Income" value={inr(MONEY.income)} />
              <MiniStat label="Spending" value={inr(MONEY.spending)} />
              <MiniStat label="Invested" value={inr(MONEY.invested)} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div
                data-reveal
                data-float="a"
                className="rounded-md border border-accent/40 bg-field p-3.5"
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">You could save {inr(TAX.potentialSavings)}</p>
                  <span className="rounded-full bg-field px-2 py-0.5 font-mono text-[10px] text-muted">3 STEPS</span>
                </div>
                <ul className="flex flex-col gap-1.5">
                  {NEXT_MOVE_STEPS.map((step, i) => (
                    <li key={step.label} className="flex items-center gap-2 text-[11px]">
                      <span
                        className={cn(
                          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full font-mono text-[9px]",
                          step.done ? "bg-accent text-accent-foreground" : "border border-line text-muted",
                        )}
                      >
                        {step.done ? "✓" : i + 1}
                      </span>
                      <span className={cn("truncate", step.done ? "text-muted line-through" : "text-foreground")}>
                        {step.label}
                      </span>
                      {step.saved && <span className="ml-auto shrink-0 font-mono text-accent-text">{step.saved}</span>}
                    </li>
                  ))}
                </ul>
              </div>

              <div data-reveal className="rounded-md border border-line bg-field p-3.5">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-foreground">Tax · {TAX.year}</p>
                  <Scale className="h-3.5 w-3.5 text-muted" strokeWidth={1.75} />
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <p className="text-muted">Estimated tax</p>
                    <Amount className="mt-0.5 block text-foreground">{inr(TAX.oldRegime.total)}</Amount>
                  </div>
                  <div>
                    <p className="text-muted">Potential savings</p>
                    <Amount className="mt-0.5 block text-accent-text">{inr(TAX.potentialSavings)}</Amount>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </WindowFrame>
    </div>
  );
}

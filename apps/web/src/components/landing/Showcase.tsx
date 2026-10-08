import { cn } from "@/lib/cn";
import { ALLOCATION, CASH_FLOW, GOALS, MONEY, TAX, inr } from "./demo-data";
import { Amount, Container, Eyebrow, WindowFrame } from "./parts";

function Stat({ label, value, caption, accent }: { label: string; value: string; caption: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-md border p-4", accent ? "border-accent/40 bg-field" : "border-line bg-field")}>
      <p className="text-xs text-muted">{label}</p>
      <Amount className={cn("mt-1.5 block text-2xl font-semibold tracking-tight", accent ? "text-accent-text" : "text-foreground")}>
        {value}
      </Amount>
      <p className="mt-1 text-[11px] text-muted">{caption}</p>
    </div>
  );
}

function CashFlowChart() {
  return (
    <div className="rounded-md border border-line bg-field p-5">
      <div className="mb-4 flex items-center justify-between text-xs text-muted">
        <span>Cash flow · 6 months</span>
        <span className="flex gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-foreground/20" /> Income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-sm bg-accent" /> Spending
          </span>
        </span>
      </div>
      <div className="flex h-32 items-end gap-3">
        {CASH_FLOW.map((m, i) => (
          <div key={m.label} className="flex flex-1 items-end gap-1" style={{ height: "100%" }}>
            <div className="h-full flex-1 self-end rounded-sm bg-foreground/20" style={{ height: `${m.income}%` }} />
            <div
              className={cn("flex-1 self-end rounded-sm bg-accent", i < CASH_FLOW.length - 1 && "opacity-55")}
              style={{ height: `${m.spending}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-3 text-center font-mono text-[10px] text-muted">
        {CASH_FLOW.map((m, i) => (
          <span key={m.label} className={cn("flex-1", i === CASH_FLOW.length - 1 && "text-foreground")}>
            {m.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function AllocationBar({ mix, dim }: { mix: { equity: number; debt: number; gold: number }; dim?: boolean }) {
  return (
    <div className={cn("flex h-3.5 gap-0.5", dim && "opacity-50")}>
      <div className="rounded-sm bg-foreground/70" style={{ flex: mix.equity }} />
      <div className="rounded-sm bg-foreground/30" style={{ flex: mix.debt }} />
      <div className="rounded-sm bg-link" style={{ flex: mix.gold }} />
    </div>
  );
}

function InvestmentsCard() {
  return (
    <div className="flex h-full flex-col rounded-md border border-line bg-field p-5">
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-xs text-muted">Investments</span>
        <span className="font-mono text-xs text-accent-text">+{inr(MONEY.investedChangeThisMonth)} this month</span>
      </div>
      <Amount className="block text-2xl font-semibold tracking-tight text-foreground">{inr(MONEY.invested)}</Amount>
      <p className="mb-2 mt-4 text-xs text-muted">Your allocation</p>
      <AllocationBar mix={ALLOCATION.current} />
      <p className="mb-2 mt-3 text-xs text-muted">Your plan</p>
      <AllocationBar mix={ALLOCATION.plan} dim />
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>Equity {ALLOCATION.current.equity}% · plan {ALLOCATION.plan.equity}%</span>
        <span>Debt {ALLOCATION.current.debt}% · plan {ALLOCATION.plan.debt}%</span>
        <span>Gold {ALLOCATION.current.gold}% · plan {ALLOCATION.plan.gold}%</span>
      </div>
      <p className="mt-auto pt-4 text-sm text-foreground">
        Your current investment allocation may need attention.
      </p>
    </div>
  );
}

function GoalsCard() {
  return (
    <div className="rounded-md border border-line bg-field p-5 lg:col-span-2">
      <p className="mb-4 text-xs text-muted">Goals</p>
      <div className="flex flex-col gap-4">
        {GOALS.map((goal) => (
          <div key={goal.label}>
            <div className="mb-1.5 flex items-center justify-between text-sm">
              <span className="text-foreground">{goal.label}</span>
              <Amount className="text-xs text-muted">
                {inr(goal.saved)} / {inr(goal.target)}
              </Amount>
            </div>
            <div className="h-1.5 rounded-full bg-field">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${Math.round((goal.saved / goal.target) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-sm text-foreground">You are on track for your emergency fund.</p>
    </div>
  );
}

function MitraReadCard() {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-accent/40 bg-field p-5">
      <p className="text-xs text-accent-text">Mitra&apos;s read</p>
      <p className="text-base leading-snug tracking-tight text-foreground">
        Your cash flow is healthy. Your portfolio is carrying more risk than you planned for.
      </p>
      <p className="text-sm text-muted">Moving ₹82,000 from equity to debt funds brings you back to plan.</p>
      <div className="mt-auto flex h-10 items-center justify-center rounded-md border border-accent/40 text-sm font-medium text-accent-text">
        See rebalance plan
      </div>
    </div>
  );
}

export function Showcase() {
  return (
    <section id="picture" className="scroll-mt-16 py-16 md:py-24">
      <Container className="flex flex-col gap-10">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Eyebrow>05 · Your financial picture</Eyebrow>
            <h2 className="text-h1 md:text-[44px]">See where your money stands.</h2>
          </div>
          <p data-reveal className="max-w-sm text-body text-muted md:text-lg">
            Income, spending, savings, investments, tax and goals in one place, with Mitra&apos;s read on each
            of them.
          </p>
        </div>

        <div data-reveal>
          <WindowFrame title="Money · October 2026">
            <div className="p-5">
              <div className="grid gap-4 sm:grid-cols-4">
                <Stat label="Income" value={inr(MONEY.income)} caption="Salary, credited 1 Oct" />
                <Stat label="Spending" value={inr(MONEY.spending)} caption="₹2,700 below your average" />
                <Stat label="Available" value={inr(MONEY.available)} caption="After regular expenses" accent />
                <Stat label="Tax this year" value={inr(TAX.oldRegime.total)} caption="₹11,900/mo as TDS" />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                <CashFlowChart />
                <InvestmentsCard />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <GoalsCard />
                <MitraReadCard />
              </div>
            </div>
          </WindowFrame>
        </div>
      </Container>
    </section>
  );
}

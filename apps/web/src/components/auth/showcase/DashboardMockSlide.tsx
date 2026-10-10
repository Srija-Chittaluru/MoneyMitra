/**
 * A fake browser-window screenshot of the dashboard — same illustrative
 * purpose as the landing page's product mockups: real screen shape and
 * copy, example figures, shown pre-login so there's no "your data" to
 * misread it as.
 */
export function DashboardMockSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center px-2">
      <div className="relative w-full max-w-[460px]">
        <div className="overflow-hidden rounded-2xl border border-line bg-card/95 shadow-[0_30px_70px_-26px_rgba(11,15,20,0.3)] backdrop-blur">
          <div className="flex h-9 items-center gap-1.5 border-b border-line px-3.5">
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="h-2.5 w-2.5 rounded-full bg-border" />
            <span className="ml-2 font-mono text-[11px] text-muted">app.moneymitra.in/dashboard</span>
          </div>
          <div className="flex">
            <div className="flex w-11 flex-none flex-col items-center gap-2.5 border-r border-line py-3.5">
              <span className="h-[18px] w-[18px] rounded-md bg-[#4772FF]" />
              <span className="h-1 w-[18px] rounded-full bg-border" />
              <span className="h-1 w-[18px] rounded-full bg-border" />
              <span className="h-1 w-[18px] rounded-full bg-border" />
              <span className="h-1 w-[18px] rounded-full bg-border" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4">
              <div className="flex items-baseline justify-between gap-2.5">
                <p className="text-[15px] font-semibold tracking-tight text-foreground">Good evening, Aditya</p>
                <p className="font-mono text-[10px] text-muted">OCT 2026</p>
              </div>
              <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
                <div className="flex flex-col gap-2 rounded-xl border border-line bg-card p-3.5">
                  <p className="text-[11px] text-muted">Available this month</p>
                  <p className="font-mono text-2xl tracking-tight text-foreground">₹32,400</p>
                  <div className="flex h-[38px] items-end gap-1">
                    {[40, 55, 48, 70, 62, 88].map((h, i) => (
                      <span
                        key={i}
                        className="flex-1 rounded-sm"
                        style={{ height: `${h}%`, backgroundColor: i === 5 ? "#4772FF" : "rgba(71,114,255,0.35)" }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex flex-col gap-2.5">
                  <div className="rounded-xl border border-line bg-card p-3">
                    <p className="text-[11px] text-muted">Old vs new regime</p>
                    <p className="mt-1 font-mono text-lg text-accent-text">−₹16,320</p>
                  </div>
                  <div className="rounded-xl border border-line bg-card p-3">
                    <p className="text-[11px] text-muted">Investments</p>
                    <p className="mt-1 font-mono text-lg text-foreground">₹4.82 L</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-accent/45 bg-card p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted">Your next move</p>
                  <p className="mt-0.5 text-[13px] font-medium leading-snug text-foreground">
                    You could potentially save ₹18,400 in taxes this year.
                  </p>
                </div>
                <span className="flex h-7 shrink-0 items-center rounded-full bg-accent px-3 text-[11px] font-semibold text-accent-foreground">
                  See steps
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute -bottom-10 -left-4 flex max-w-[220px] items-start gap-2.5 rounded-[16px_16px_16px_4px] border border-line bg-card/95 p-3 shadow-[0_20px_40px_-18px_rgba(11,15,20,0.3)] backdrop-blur">
          <span
            className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-sm"
            style={{ background: "linear-gradient(135deg, #65F2A4 50%, #4772FF 50%)" }}
          />
          <div>
            <p className="text-[11px] text-muted">Mitra</p>
            <p className="mt-0.5 text-xs leading-snug text-foreground">
              Your ITR is prefilled from 5 documents. Want to review it?
            </p>
          </div>
        </div>

        <div className="absolute -right-2 -top-5 rounded-xl border border-link/40 bg-card/95 px-3.5 py-2.5 shadow-[0_20px_40px_-18px_rgba(11,15,20,0.3)] backdrop-blur">
          <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[#3155E0] dark:text-[#7B9AFF]">
            My journey
          </p>
          <p className="mt-0.5 text-xs text-foreground">Home down payment · 2030</p>
        </div>
      </div>
    </div>
  );
}

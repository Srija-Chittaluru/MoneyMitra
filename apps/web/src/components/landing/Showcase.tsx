import { FileCheck2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { FINANCE_PREVIEW, TAX, inr } from "./demo-data";
import { Amount, Container, Eyebrow, Pill, PhotoBackground, WindowFrame } from "./parts";

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

function IncomeCard() {
  const { incomeLines } = FINANCE_PREVIEW;
  const largest = Math.max(...incomeLines.map((l) => l.value));
  return (
    <div className="rounded-md border border-line bg-field p-5 lg:col-span-2">
      <p className="mb-4 text-xs text-muted">Where your income comes from</p>
      <div className="flex flex-col gap-3">
        {incomeLines.map((line) => (
          <div key={line.label}>
            <div className="flex items-center justify-between text-sm">
              <span className="text-foreground">{line.label}</span>
              <Amount className="text-xs text-muted">{inr(line.value)}</Amount>
            </div>
            <div className="mt-1.5 h-2 rounded-full bg-card">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(6, (100 * line.value) / largest)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 border-t border-line pt-4 text-sm text-foreground">
        Gross total income <span className="font-semibold">{inr(TAX.gross)}</span>
      </p>
    </div>
  );
}

function TaxSavingCard() {
  return (
    <div className="rounded-md border border-line bg-field p-5">
      <p className="mb-4 text-xs text-muted">Tax-saving room, FY {TAX.year.replace("FY ", "")}</p>
      <div className="flex flex-col gap-3">
        {FINANCE_PREVIEW.taxSaving.map((s) => {
          const used = Math.round((100 * s.declared) / s.cap);
          return (
            <div key={s.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="text-foreground">{s.label}</span>
                <span className="text-muted">
                  {inr(s.declared)} / {inr(s.cap)}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 rounded-full bg-card">
                <div
                  className={cn("h-full rounded-full", used >= 100 ? "bg-accent" : "bg-primary")}
                  style={{ width: `${Math.min(100, used)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FilingCard() {
  const { filing } = FINANCE_PREVIEW;
  return (
    <div className="flex h-full flex-col gap-3 rounded-md border border-accent/40 bg-field p-5 lg:col-span-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted">ITR filing</p>
        <Pill tone="accent">{filing.form}</Pill>
        <span className="text-xs text-muted">AY {filing.assessmentYear}</span>
      </div>
      <p className="text-base leading-snug tracking-tight text-foreground">
        Your Form 16, AIS and 26AS are matched line by line — filing is a quick check, not a project.
      </p>
      <div className="mt-auto flex items-center gap-2 text-sm font-medium text-accent-text">
        <FileCheck2 className="h-4 w-4" strokeWidth={1.75} />
        Ready to file
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
            Income, tax, tax-saving room and your ITR filing status in one place — built from your own documents,
            not a spreadsheet you have to maintain.
          </p>
        </div>

        <div data-reveal>
          <WindowFrame title="MoneyMitra · Finance Management">
            <div className="relative isolate overflow-hidden bg-field p-5">
              <PhotoBackground
                src="/landing/pixel-sky.png"
                objectPosition="50% 100%"
                sizes="(max-width: 1024px) 100vw, 1360px"
                className="hidden -z-10 dark:block"
              />
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/60 to-background/30"
              />
              <div className="grid gap-4 sm:grid-cols-4">
                <Stat label="Gross total income" value={inr(TAX.gross)} caption={TAX.year} />
                <Stat label="Estimated tax" value={inr(TAX.oldRegime.total)} caption={`${FINANCE_PREVIEW.effectiveRate}% effective rate`} />
                <Stat label="Refund due" value={inr(FINANCE_PREVIEW.refundDue)} caption="TDS paid is more than your tax" accent />
                <Stat label="Monthly take-home" value={inr(FINANCE_PREVIEW.monthlyTakeHome)} caption="Salary after TDS" />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <IncomeCard />
                <TaxSavingCard />
              </div>
              <div className="mt-4 grid gap-4 lg:grid-cols-3">
                <FilingCard />
              </div>
            </div>
          </WindowFrame>
        </div>
      </Container>
    </section>
  );
}

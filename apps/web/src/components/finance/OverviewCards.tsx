import Link from "next/link";
import { CalendarClock, FileCheck2, FileStack, LineChart, PiggyBank, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { EmptyPanel } from "@/components/dashboard/EmptyPanel";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import { formatRupees } from "@/lib/format";
import type {
  AmountLine,
  FinanceAction,
  FinanceAlert,
  FinanceDocuments,
  FinanceFiling,
  FinanceIncome,
  FinanceInvestments,
  FinanceTax,
  TaxSavingSection,
} from "@/lib/finance/types";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

export function formatDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

function CardHeader({ title, href, linkLabel }: { title: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <h3 className="text-h2">{title}</h3>
      {href && linkLabel && (
        <Link href={href}>
          <Button variant="ghost" size="sm">
            {linkLabel}
          </Button>
        </Link>
      )}
    </div>
  );
}

function Row({ label, value, strong, tone }: { label: ReactNode; value: ReactNode; strong?: boolean; tone?: "success" | "error" }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <span className={strong ? "font-medium text-foreground" : "text-muted"}>{label}</span>
      <span
        className={cn(
          "text-right tabular-nums",
          strong && "font-semibold text-foreground",
          tone === "success" && "text-success",
          tone === "error" && "text-error",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function signedRupees(amount: number): string {
  return amount < 0 ? `−${formatRupees(-amount)}` : formatRupees(amount);
}

/* ---------- Top tiles ---------- */

export function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "success" | "error" }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-muted">{label}</p>
      <p
        className={cn(
          "mt-2 text-amount-lg tabular-nums text-foreground",
          tone === "success" && "text-success",
          tone === "error" && "text-error",
        )}
      >
        {value}
      </p>
      {hint && <p className="mt-1 text-sm text-muted">{hint}</p>}
    </Card>
  );
}

/* ---------- Income ---------- */

export function IncomeCard({ income }: { income: FinanceIncome }) {
  const positive = income.lines.filter((line) => line.amount > 0);
  const largest = Math.max(1, ...positive.map((line) => line.amount));
  return (
    <Card className="lg:col-span-2">
      <CardHeader title="Where your income comes from" href="/itr-filing" linkLabel="Edit in ITR" />
      <div className="flex flex-col gap-3">
        {income.lines.map((line) => (
          <div key={line.key}>
            <div className="flex items-center justify-between gap-4 text-sm">
              <span className={line.amount < 0 ? "text-muted" : "text-foreground"}>{line.label}</span>
              <span className="tabular-nums">{signedRupees(line.amount)}</span>
            </div>
            {line.amount > 0 && (
              <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
                <div
                  className="h-2 rounded-full bg-primary"
                  style={{ width: `${Math.max(2, (100 * line.amount) / largest)}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 border-t border-border pt-2">
        <Row label="Gross total income" value={formatRupees(income.total)} strong />
      </div>
    </Card>
  );
}

/* ---------- Tax ---------- */

export function TaxCard({ tax }: { tax: FinanceTax }) {
  return (
    <Card>
      <CardHeader title="Tax" href="/tax-comparison" linkLabel="Compare" />
      <div className="divide-y divide-border">
        <Row label={`Tax (${tax.regime} regime)`} value={formatRupees(tax.tax)} strong />
        <Row label="Effective rate" value={`${tax.effective_rate}%`} />
        {tax.other_regime_tax !== null && (
          <Row label={`Under the ${tax.regime === "new" ? "old" : "new"} regime`} value={formatRupees(tax.other_regime_tax)} />
        )}
        {tax.taxes_paid !== null && <Row label="Already paid (TDS & advance tax)" value={formatRupees(tax.taxes_paid)} />}
        {tax.refund_due ? (
          <Row label="Refund due" value={formatRupees(tax.refund_due)} tone="success" strong />
        ) : tax.balance_payable ? (
          <Row label="Still to pay" value={formatRupees(tax.balance_payable)} tone="error" strong />
        ) : null}
      </div>
      {tax.taxes_paid !== null && (
        <p className="mt-3 text-caption text-muted">Refund and amount to pay include any interest and late-filing fee.</p>
      )}
    </Card>
  );
}

/* ---------- ITR filing ---------- */

export function FilingCard({ filing }: { filing: FinanceFiling | null }) {
  return (
    <Card>
      <CardHeader title="ITR filing" />
      {filing ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="accent">{filing.form}</Badge>
            <span className="text-sm text-muted">AY {filing.assessment_year}</span>
            {filing.is_belated ? (
              <Badge variant="warning">Late return</Badge>
            ) : (
              <Badge variant="neutral">{filing.days_to_due} days left</Badge>
            )}
          </div>
          <div className="divide-y divide-border">
            <Row label="Due date" value={formatDate(filing.due_date)} />
            <Row
              label="Status"
              value={
                filing.ready_to_file
                  ? "Ready to file"
                  : `${filing.open_items} item${filing.open_items === 1 ? "" : "s"} to fix`
              }
              tone={filing.ready_to_file ? "success" : undefined}
            />
          </div>
          {filing.is_belated && (
            <p className="text-caption text-muted">
              The due date has passed: a late fee applies and only the new regime is allowed. Late returns can be filed
              until 31 Dec 2026.
            </p>
          )}
          <Link href="/itr-filing">
            <Button size="sm" className="w-full">
              {filing.ready_to_file ? "Download your ITR" : "Continue filing"}
            </Button>
          </Link>
        </div>
      ) : (
        <EmptyPanel
          icon={FileCheck2}
          description="Upload your Form 16 or AIS and MoneyMitra picks the right ITR form and fills it."
          action={
            <Link href="/itr-filing">
              <Button variant="secondary" size="sm">
                Start ITR
              </Button>
            </Link>
          }
        />
      )}
    </Card>
  );
}

/* ---------- Investments ---------- */

function LineList({ lines }: { lines: AmountLine[] }) {
  return (
    <div className="divide-y divide-border">
      {lines.map((line) => (
        <Row
          key={line.key}
          label={line.label}
          value={signedRupees(line.amount)}
          tone={line.amount < 0 ? "error" : undefined}
        />
      ))}
    </div>
  );
}

export function InvestmentsCard({ investments }: { investments: FinanceInvestments | null }) {
  return (
    <Card>
      <CardHeader title="Investments & trading" />
      {investments ? (
        <div className="flex flex-col gap-4">
          {investments.trades > 0 && (
            <div>
              <p className="text-sm text-muted">
                {investments.trades} sale{investments.trades === 1 ? "" : "s"} worth {formatRupees(investments.sale_value)}
              </p>
              <LineList lines={investments.gains} />
              <div className="border-t border-border">
                <Row label="Capital gains" value={signedRupees(investments.total_gain)} strong />
              </div>
            </div>
          )}
          {investments.trading.length > 0 && (
            <div>
              <p className="text-sm font-medium text-foreground">Trading profit</p>
              <LineList lines={investments.trading} />
            </div>
          )}
        </div>
      ) : (
        <EmptyPanel
          icon={LineChart}
          description="Upload your broker's capital gains or Tax P&L statement to see your realised gains and trading profit."
          action={
            <Link href="/documents">
              <Button variant="secondary" size="sm">
                Upload statement
              </Button>
            </Link>
          }
        />
      )}
    </Card>
  );
}

/* ---------- Tax saving ---------- */

export function TaxSavingCard({ sections, year, note }: { sections: TaxSavingSection[]; year: string; note: string }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader title={`Tax-saving room, FY ${year}`} href="/tax-planning" linkLabel="Plan" />
      {sections.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {sections.map((s) => {
              const used = s.cap ? Math.min(100, (100 * s.declared) / s.cap) : 0;
              return (
                <div key={s.section}>
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-foreground">{s.label}</span>
                    <span className="tabular-nums text-muted">
                      {formatRupees(s.declared)} / {formatRupees(s.cap)}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-surface-muted">
                    <div className="h-2 rounded-full bg-success" style={{ width: `${used}%` }} />
                  </div>
                  <p className="mt-1 text-caption text-muted">
                    {s.headroom > 0 ? `${formatRupees(s.headroom)} left` : "Fully used"}
                  </p>
                </div>
              );
            })}
          </div>
          <p className="mt-4 text-caption text-muted">{note}</p>
        </>
      ) : (
        <EmptyPanel
          icon={PiggyBank}
          description="Add your income and deductions to see how much room is left under 80C, 80D, NPS and home loan interest."
        />
      )}
    </Card>
  );
}

/* ---------- Documents ---------- */

export function DocumentsCard({ documents }: { documents: FinanceDocuments }) {
  return (
    <Card>
      <CardHeader title="Documents" href="/documents" linkLabel="Manage" />
      {documents.uploaded > 0 ? (
        <div className="divide-y divide-border">
          {documents.by_category.map((d) => (
            <Row key={d.category} label={d.label} value={d.count} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No documents uploaded yet.</p>
      )}
      {documents.missing.length > 0 && (
        <div className="mt-4 rounded-md bg-warning-bg p-3">
          <p className="text-sm font-medium text-warning">Still needed</p>
          <ul className="mt-1 flex flex-col gap-1">
            {documents.missing.map((m) => (
              <li key={m.category} className="text-sm text-foreground">
                <span className="font-medium">{m.title}</span> <span className="text-muted">— {m.why}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {documents.uploaded === 0 && (
        <Link href="/documents" className="mt-4 block">
          <Button variant="secondary" size="sm" className="w-full">
            <FileStack className="h-4 w-4" /> Upload documents
          </Button>
        </Link>
      )}
    </Card>
  );
}

/* ---------- Next steps & dates ---------- */

export function ActionsCard({ actions }: { actions: FinanceAction[] }) {
  return (
    <Card>
      <CardHeader title="Next steps" href="/recommendations" linkLabel="All" />
      {actions.length > 0 ? (
        <div className="flex flex-col gap-4">
          {actions.map((a) => (
            <div key={a.title}>
              <p className="font-medium text-foreground">{a.title}</p>
              <p className="mt-0.5 text-sm text-muted">{a.description}</p>
              {a.action_href && a.action_label && (
                <Link href={a.action_href} className="mt-1 inline-block text-sm font-medium text-link hover:underline">
                  {a.action_label} →
                </Link>
              )}
            </div>
          ))}
        </div>
      ) : (
        <EmptyPanel icon={Sparkles} description="Add your details and personalised suggestions will show up here." />
      )}
    </Card>
  );
}

export function AlertsCard({ alerts }: { alerts: FinanceAlert[] }) {
  return (
    <Card>
      <CardHeader title="Upcoming dates" href="/resources" linkLabel="All" />
      {alerts.length > 0 ? (
        <div className="flex flex-col gap-3">
          {alerts.map((a) => (
            <div key={a.title} className="flex gap-3">
              <CalendarClock className="mt-0.5 h-5 w-5 shrink-0 text-muted" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium text-foreground">{a.title}</p>
                <p className="text-caption text-muted">{formatDate(a.date)}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted">No upcoming tax dates.</p>
      )}
    </Card>
  );
}

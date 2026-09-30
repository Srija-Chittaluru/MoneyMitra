import type { ReactNode } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FileText,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/cn";
import {
  DOCUMENTS,
  FINANCE,
  RECOMMENDATIONS,
  TAX,
  TAX_ROWS,
  inr,
  type DocTone,
} from "./demo-data";
import {
  Amount,
  Container,
  Eyebrow,
  Pill,
  WindowFrame,
} from "./parts";

/* ---------- Row layout ---------- */

function ShowcaseRow({
  eyebrow,
  title,
  description,
  points,
  reverse,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  points: string[];
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2 lg:gap-16">
      <div className={cn("flex flex-col gap-5", reverse && "lg:order-2")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h3 className="text-h1 md:text-[40px]">{title}</h3>
        <p className="text-body text-muted md:text-lg">{description}</p>
        <ul className="flex flex-col gap-3">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-body">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-muted text-link">
                <Check className="h-3 w-3" strokeWidth={2.5} />
              </span>
              {point}
            </li>
          ))}
        </ul>
      </div>
      <div className={cn(reverse && "lg:order-1")}>{children}</div>
    </div>
  );
}

/* ---------- 1. Tax comparison UI ---------- */

function TaxComparisonUI() {
  const oldTotal = TAX.oldRegime;
  const newTotal = TAX.newRegime;

  return (
    <WindowFrame title={`Tax comparison · ${TAX.year}`}>
      <div
        role="img"
        aria-label={`Demo tax comparison: the new regime costs ${inr(newTotal.total)} versus ${inr(oldTotal.total)} under the old regime`}
        className="p-4 sm:p-6"
      >
        <div aria-hidden>
          <div className="grid grid-cols-[1.3fr_1fr_1fr] items-end gap-2 border-b border-border pb-3 text-xs sm:gap-4">
            <span className="text-muted">Line item</span>
            <span className="text-right font-medium text-foreground">Old</span>
            <span className="flex flex-col items-end gap-1 text-right font-medium text-foreground">
              <Pill tone="accent">Recommended</Pill>
              New
            </span>
          </div>

          <div className="divide-y divide-border">
            {TAX_ROWS.map((row, i) => (
              <div
                key={row.label}
                className="grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 py-3 text-[13px] sm:gap-4 sm:text-sm"
              >
                <span className={i === 0 ? "font-medium text-foreground" : "text-muted"}>
                  {row.label}
                </span>
                <Amount className="text-right text-foreground">
                  {row.old === null ? "—" : row.old < 0 ? `−${inr(-row.old)}` : inr(row.old)}
                </Amount>
                <Amount
                  className={cn(
                    "text-right",
                    row.new === null ? "text-muted" : "text-foreground",
                  )}
                >
                  {row.new === null ? "—" : row.new < 0 ? `−${inr(-row.new)}` : inr(row.new)}
                </Amount>
              </div>
            ))}
            <div className="grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 py-3 text-[13px] sm:gap-4 sm:text-sm">
              <span className="font-medium text-foreground">Taxable income</span>
              <Amount className="text-right text-foreground">{inr(oldTotal.taxable)}</Amount>
              <Amount className="text-right text-foreground">{inr(newTotal.taxable)}</Amount>
            </div>
          </div>

          <div className="mt-2 grid grid-cols-[1.3fr_1fr_1fr] items-center gap-2 rounded-md bg-surface-muted px-3 py-3.5 sm:gap-4">
            <span className="text-[13px] font-semibold text-foreground sm:text-sm">
              Total tax (incl. cess)
            </span>
            <Amount className="text-right text-[13px] text-foreground sm:text-base">
              {inr(oldTotal.total)}
            </Amount>
            <Amount className="text-right text-[13px] text-foreground sm:text-base">
              {inr(newTotal.total)}
            </Amount>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-md border border-border p-3.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-success-bg text-success">
              <CheckCircle2 className="h-4 w-4" />
            </span>
            <p className="text-[13px] text-foreground sm:text-sm">
              The new regime saves you{" "}
              <Amount className="text-success">{inr(TAX.savings)}</Amount> this
              year.
            </p>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- 2. Documents + recommendations UI ---------- */

const DOC_ICON_STYLES: Record<DocTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
};

const DOC_PILL_TONE: Record<DocTone, "success" | "warning" | "error"> = {
  success: "success",
  warning: "warning",
  error: "error",
};

function AttentionUI() {
  const readyCount = DOCUMENTS.filter((d) => d.tone === "success").length;

  return (
    <WindowFrame title="Documents & recommendations">
      <div
        role="img"
        aria-label="Demo view of document status, with two documents extracted, one needing re-upload and one missing, followed by two personalised recommendations"
        className="flex flex-col gap-5 p-4 sm:p-6"
      >
        <div aria-hidden className="flex flex-col gap-5">
          <div>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">Tax readiness</span>
              <span className="text-muted">
                {readyCount} of {DOCUMENTS.length} documents ready
              </span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted">
              <div
                className="h-full rounded-full bg-link"
                style={{ width: `${(readyCount / DOCUMENTS.length) * 100}%` }}
              />
            </div>
          </div>

          <ul className="divide-y divide-border rounded-md border border-border">
            {DOCUMENTS.map((doc) => (
              <li key={doc.name} className="flex items-center gap-3 px-3.5 py-3">
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                    DOC_ICON_STYLES[doc.tone],
                  )}
                >
                  {doc.tone === "success" ? (
                    <FileText className="h-4 w-4" strokeWidth={1.75} />
                  ) : (
                    <AlertCircle className="h-4 w-4" strokeWidth={1.75} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium text-foreground">
                    {doc.name}
                  </p>
                  <p className="truncate text-[11px] text-muted">{doc.detail}</p>
                </div>
                <Pill tone={DOC_PILL_TONE[doc.tone]}>{doc.status}</Pill>
              </li>
            ))}
          </ul>

          <div>
            <p className="mb-2 text-xs font-medium text-foreground">Suggested next</p>
            <ul className="flex flex-col gap-2.5">
              {RECOMMENDATIONS.map((rec) => (
                <li
                  key={rec.title}
                  className="flex items-start gap-3 rounded-md border border-border bg-background p-3.5"
                >
                  <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-muted text-link">
                    <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[13px] font-semibold text-foreground">
                        {rec.title}
                      </p>
                      <Pill tone="neutral">{rec.tag}</Pill>
                    </div>
                    <p className="mt-1 text-[11px] leading-4 text-muted">
                      {rec.reason}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- 3. Finance UI ---------- */

function FinanceUI() {
  const { months, chartMax, categories, transactions } = FINANCE;
  const topCategory = categories[0].amount;

  return (
    <WindowFrame title="Finance · September">
      <div
        role="img"
        aria-label={`Demo finance view: ${inr(FINANCE.spent)} spent and ${inr(FINANCE.saved)} saved this month, a ${FINANCE.savingsRate} percent savings rate, with a six month spending chart and spending by category`}
        className="p-4 sm:p-6"
      >
        <div aria-hidden className="flex flex-col gap-5">
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              { label: "Spent", value: inr(FINANCE.spent) },
              { label: "Saved", value: inr(FINANCE.saved) },
              { label: "Savings rate", value: `${FINANCE.savingsRate}%` },
            ].map((s) => (
              <div key={s.label} className="min-w-0 rounded-md border border-border p-2.5 sm:p-3">
                <p className="text-[10px] text-muted sm:text-[11px]">{s.label}</p>
                <Amount className="mt-1 block truncate text-[13px] text-foreground sm:text-base">
                  {s.value}
                </Amount>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-xs font-medium text-foreground">
                Spending, last 6 months
              </p>
              <div className="relative flex h-28 items-end gap-2">
                <div
                  className="absolute inset-x-0 border-t border-dashed border-foreground/30"
                  style={{ bottom: `${(FINANCE.monthlyIncome / chartMax) * 100}%` }}
                />
                {months.map((m, i) => (
                  <div
                    key={m.label}
                    className={cn(
                      "flex-1 rounded-sm",
                      i === months.length - 1 ? "bg-link" : "bg-foreground/15",
                    )}
                    style={{ height: `${(m.spent / chartMax) * 100}%` }}
                  />
                ))}
              </div>
              <div className="mt-1.5 flex gap-2">
                {months.map((m) => (
                  <span key={m.label} className="flex-1 text-center text-[10px] text-muted">
                    {m.label}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-muted">
                Dashed line: monthly take-home
              </p>
            </div>

            <div>
              <p className="mb-3 text-xs font-medium text-foreground">By category</p>
              <ul className="flex flex-col gap-3">
                {categories.map((c, i) => (
                  <li key={c.label}>
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-muted">{c.label}</span>
                      <Amount className="text-foreground">{inr(c.amount)}</Amount>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-muted">
                      <div
                        className="h-full rounded-full bg-link"
                        style={{
                          width: `${(c.amount / topCategory) * 100}%`,
                          opacity: 1 - i * 0.16,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <ul className="divide-y divide-border rounded-md border border-border">
            {transactions.map((t) => (
              <li key={t.title} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-medium text-foreground">{t.title}</p>
                  <p className="truncate text-[11px] text-muted">{t.subtitle}</p>
                </div>
                <Amount
                  className={cn(
                    "text-[13px]",
                    t.amount > 0 ? "text-success" : "text-foreground",
                  )}
                >
                  {t.amount > 0 ? "+" : "−"}
                  {inr(Math.abs(t.amount))}
                </Amount>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </WindowFrame>
  );
}

/* ---------- Section ---------- */

export function Showcase() {
  return (
    <section id="product" className="scroll-mt-16 py-16 md:py-24">
      <Container className="flex flex-col gap-16 md:gap-24">
        <div className="flex max-w-2xl flex-col gap-3">
          <Eyebrow>Product</Eyebrow>
          <h2 className="text-h1 md:text-[40px]">
            See your whole financial picture, not just a tax number.
          </h2>
        </div>

        <ShowcaseRow
          eyebrow="Tax"
          title="Know what you owe."
          description="Line-by-line, old regime next to new. See which deductions actually move the needle and what each choice costs you this year."
          points={[
            "Both regimes calculated from the same income",
            "Every deduction itemised, nothing hidden",
            "A clear recommendation with the saving spelled out",
          ]}
        >
          <TaxComparisonUI />
        </ShowcaseRow>

        <ShowcaseRow
          reverse
          eyebrow="Documents & recommendations"
          title="Know what needs your attention."
          description="MoneyMitra tracks what it has read, what is missing, and what to do next — so nothing slips through before you declare."
          points={[
            "Extraction status for every document",
            "Missing or unreadable files flagged early",
            "Suggestions that explain why they apply to you",
          ]}
        >
          <AttentionUI />
        </ShowcaseRow>

        <ShowcaseRow
          eyebrow="Finance"
          title="Know where your money is going."
          description="Spending, savings and recent activity in one calm view, sitting right beside your tax position."
          points={[
            "Monthly spending trend at a glance",
            "Categories ranked by where the money goes",
            "Your savings rate, tracked over time",
          ]}
        >
          <FinanceUI />
        </ShowcaseRow>
      </Container>
    </section>
  );
}

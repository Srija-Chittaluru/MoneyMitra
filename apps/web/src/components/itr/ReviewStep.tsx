"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ChevronRight, Download, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { ApiError } from "@/lib/api-client";
import { formatRupees } from "@/lib/format";
import { cn } from "@/lib/cn";
import { exportItr, exportItrPdf } from "@/lib/itr/api";
import type { Issue, ItrExport, ItrSummary } from "@/lib/itr/types";
import { ComputationCard } from "./ComputationCard";
import { Notice } from "./fields";
import { STEPS, stepForField } from "./options";

function downloadJson(fileName: string, data: object) {
  downloadBlob(fileName, new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
}

function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

const COLLAPSED_COUNT = 4;

function IssueGroup({
  title,
  issues,
  onFix,
}: {
  title: string;
  issues: Issue[];
  onFix?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? issues : issues.slice(0, COLLAPSED_COUNT);
  const hidden = issues.length - visible.length;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-md border border-border bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-foreground">
          {title} <span className="font-normal text-muted">· {issues.length}</span>
        </p>
        {onFix && (
          <Button variant="secondary" size="sm" onClick={onFix} className="shrink-0">
            Fix
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm text-foreground">
        {visible.map((issue, index) => (
          <li key={`${issue.field ?? ""}-${index}`} className="break-words">
            {issue.message}
          </li>
        ))}
      </ul>
      {issues.length > COLLAPSED_COUNT && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start text-sm font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          {expanded ? "Show less" : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}

function IssueList({
  title,
  description,
  issues,
  variant,
  onJump,
}: {
  title: string;
  description?: string;
  issues: Issue[];
  variant: "error" | "warning";
  onJump?: (step: number) => void;
}) {
  // Group by the step that owns each field, in step order; form-level issues last.
  const groups = new Map<number | null, Issue[]>();
  for (const issue of issues) {
    const step = onJump ? stepForField(issue.field) : null;
    groups.set(step, [...(groups.get(step) ?? []), issue]);
  }
  const ordered = [...groups.entries()].sort(([a], [b]) => (a ?? 99) - (b ?? 99));

  return (
    <Notice variant={variant} title={`${title} (${issues.length})`}>
      {description && <p className="mb-3 text-sm text-muted">{description}</p>}
      <div className="grid gap-3 lg:grid-cols-2">
        {ordered.map(([step, items]) => (
          <IssueGroup
            key={step ?? "general"}
            title={step ? `Step ${step} · ${STEPS[step - 1].label}` : "General"}
            issues={items}
            onFix={step && onJump ? () => onJump(step) : undefined}
          />
        ))}
      </div>
    </Notice>
  );
}

function SummaryTile({
  label,
  amount,
  helpText,
  tone,
}: {
  label: string;
  amount: number;
  helpText?: string;
  tone?: "accent" | "success";
}) {
  return (
    <Card
      className={cn(
        "flex min-w-0 flex-col gap-1 p-4 sm:p-5",
        tone === "accent" && "ring-2 ring-accent",
        tone === "success" && "ring-2 ring-success",
      )}
    >
      <p className="text-sm text-muted">{label}</p>
      <p className="break-all text-2xl font-semibold leading-tight text-foreground sm:text-[1.75rem]">
        {formatRupees(amount)}
      </p>
      {helpText && <p className="text-sm text-muted">{helpText}</p>}
    </Card>
  );
}

export function ReviewStep({
  ay,
  summary,
  isLoading,
  error,
  onRetry,
  onJump,
  saving,
}: {
  ay: string;
  summary: ItrSummary | undefined;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
  onJump: (step: number) => void;
  saving: boolean;
}) {
  const exportMutation = useMutation<ItrExport, ApiError, void>({
    mutationFn: () => exportItr(ay),
    onSuccess: (result) => downloadJson(result.file_name, result.itr),
  });
  const pdfMutation = useMutation<Blob, ApiError, void>({
    mutationFn: () => exportItrPdf(ay),
    onSuccess: (blob) => downloadBlob(`ITR1_AY${ay}_summary.pdf`, blob),
  });

  if (isLoading || (saving && !summary)) {
    return (
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error || !summary) {
    return (
      <ErrorState
        title="Couldn't calculate your return"
        description={error?.message}
        action={
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Try again
          </Button>
        }
      />
    );
  }

  const { selected, alternative } = summary;
  const payable = selected.balance_payable > 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={summary.is_belated ? "warning" : "success"}>
          {summary.is_belated ? "Belated return u/s 139(4)" : "Original return u/s 139(1)"}
        </Badge>
        <span className="text-sm text-muted">
          AY {summary.assessment_year} · {selected.regime === "new" ? "New" : "Old"} regime · filing date{" "}
          {summary.filing_date}
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <SummaryTile label="Total income" amount={selected.total_income} />
        <SummaryTile label="Tax + interest" amount={selected.total_tax_and_interest} />
        <SummaryTile label="Taxes paid" amount={selected.total_taxes_paid} />
        <SummaryTile
          label={payable ? "Balance payable" : "Refund due"}
          amount={payable ? selected.balance_payable : selected.refund_due}
          helpText={payable ? "Pay before uploading" : undefined}
          tone={payable ? "accent" : "success"}
        />
      </div>

      {alternative && (
        <p className="text-sm text-muted">
          Under the {alternative.regime === "new" ? "new" : "old"} regime your tax + interest would be{" "}
          <span className="text-foreground">{formatRupees(alternative.total_tax_and_interest)}</span>{" "}
          ({alternative.balance_payable > 0
            ? `${formatRupees(alternative.balance_payable)} payable`
            : `${formatRupees(alternative.refund_due)} refund`}
          ).
        </p>
      )}

      {summary.eligibility_issues.length > 0 && (
        <IssueList
          title="ITR-1 can't be used"
          description="Based on your answers and documents, this return needs a different ITR form."
          issues={summary.eligibility_issues}
          variant="error"
          onJump={onJump}
        />
      )}
      {summary.missing_fields.length > 0 && (
        <IssueList
          title="Details to complete"
          description="Fill these in to enable the download. Fields marked * on each step are required."
          issues={summary.missing_fields}
          variant="warning"
          onJump={onJump}
        />
      )}
      {summary.warnings.length > 0 && (
        <IssueList
          title="Please double-check"
          issues={summary.warnings.map((message) => ({ field: null, message }))}
          variant="warning"
        />
      )}

      {payable && (
        <Notice variant="warning" title={`Pay ${formatRupees(selected.balance_payable)} before you file`}>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Pay through <span className="font-medium">e-Pay Tax</span> on incometax.gov.in using Challan 280
              (ITNS 280), Minor head 300 – Self-assessment tax, for AY {summary.assessment_year}.
            </li>
            <li>Add the challan (BSR code, date, serial no., amount) in step 4.</li>
            <li>Come back here and download the JSON again.</li>
          </ol>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onJump(4)}>
            Go to taxes paid
          </Button>
        </Notice>
      )}

      <ComputationCard data={selected} />

      <Card>
        <h3 className="text-h2 mb-2">Download your return</h3>
        <p className="mb-4 text-sm text-muted">
          MoneyMitra prepares the return from what you entered; you are responsible for checking it against Form 16,
          AIS and Form 26AS before uploading.
        </p>
        {exportMutation.isError && <p className="mb-3 text-sm text-error">{exportMutation.error.message}</p>}
        {pdfMutation.isError && <p className="mb-3 text-sm text-error">{pdfMutation.error.message}</p>}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="primary"
            disabled={!summary.can_export || saving || exportMutation.isPending}
            onClick={() => exportMutation.mutate()}
          >
            <Download className="h-4 w-4" />
            {exportMutation.isPending ? "Preparing…" : "Download ITR-1 JSON"}
          </Button>
          <Button
            variant="secondary"
            disabled={saving || pdfMutation.isPending}
            onClick={() => pdfMutation.mutate()}
          >
            <FileText className="h-4 w-4" />
            {pdfMutation.isPending ? "Preparing…" : "Download summary (PDF)"}
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted">
          The JSON is the file you upload on the Income Tax portal. The PDF is a readable copy to review or share
          {summary.can_export ? "" : " — it's marked DRAFT until the issues above are fixed"}.
        </p>

        {exportMutation.isSuccess && (
          <div className="mt-6">
            <p className="mb-2 font-semibold text-foreground">
              Downloaded {exportMutation.data.file_name}. Now upload it:
            </p>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-foreground">
              <li>Log in at incometax.gov.in.</li>
              <li>Go to e-File → Income Tax Returns → File Income Tax Return.</li>
              <li>Select AY {summary.assessment_year} and choose the Offline mode (&quot;Upload JSON&quot;).</li>
              <li>Select ITR-1, upload the downloaded file and review the pre-filled details.</li>
              <li>Proceed to verification and submit.</li>
              <li>E-verify within 30 days using Aadhaar OTP or net banking.</li>
            </ol>
          </div>
        )}
      </Card>
    </div>
  );
}

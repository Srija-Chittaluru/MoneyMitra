"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Button } from "@/components/ui/Button";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DeductionsStep } from "@/components/itr/DeductionsStep";
import { IncomeStep } from "@/components/itr/IncomeStep";
import { PersonalStep } from "@/components/itr/PersonalStep";
import { RegimeBankStep } from "@/components/itr/RegimeBankStep";
import { ReviewStep } from "@/components/itr/ReviewStep";
import { Stepper } from "@/components/itr/Stepper";
import { TaxesPaidStep } from "@/components/itr/TaxesPaidStep";
import { FieldSourcesProvider, Notice } from "@/components/itr/fields";
import { LAST_STEP } from "@/components/itr/options";
import Link from "next/link";
import { useAuth } from "@/lib/auth/AuthContext";
import type { User } from "@/lib/auth/types";
import { ApiError } from "@/lib/api-client";
import { getAssessmentYears, getItrFiling, getItrSummary, rereadDocuments, saveItrFiling } from "@/lib/itr/api";
import type { ItrDraftData, ItrFilingOut } from "@/lib/itr/types";

function withProfileDefaults(data: ItrDraftData, user: User | null): ItrDraftData {
  return {
    ...data,
    personal: {
      ...data.personal,
      date_of_birth: data.personal.date_of_birth || user?.date_of_birth || null,
      email: data.personal.email || user?.email || null,
    },
  };
}

function valueAt(data: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>(
    (node, key) => (node && typeof node === "object" ? (node as Record<string, unknown>)[key] : undefined),
    data,
  );
}

/** Keeps a field's "auto-filled" tag only while its value is unchanged from the saved draft. */
function activeSources(
  sources: Record<string, string>,
  saved: ItrDraftData,
  current: ItrDraftData,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(sources).filter(([path]) => valueAt(saved, path) === valueAt(current, path)),
  );
}

function formatDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-64 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default function ItrFilingPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const yearsQuery = useQuery({ queryKey: ["itr-assessment-years"], queryFn: getAssessmentYears });
  const yearInfo = yearsQuery.data?.[0];
  const ay = yearInfo?.assessment_year ?? "";

  const filingQuery = useQuery({
    queryKey: ["itr-filing", ay],
    queryFn: () => getItrFiling(ay),
    enabled: !!ay,
  });

  const [step, setStep] = useState(1);
  const [localDraft, setLocalDraft] = useState<ItrDraftData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Until the user edits something, the draft mirrors the server copy.
  const draft = localDraft ?? (filingQuery.data ? withProfileDefaults(filingQuery.data.data, user) : null);

  const summaryQuery = useQuery({
    queryKey: ["itr-summary", ay],
    queryFn: () => getItrSummary(ay),
    enabled: !!ay && !!filingQuery.data && step >= 5,
  });

  const saveMutation = useMutation<ItrFilingOut, ApiError, ItrDraftData>({
    mutationFn: (data) => saveItrFiling(ay, data),
    onSuccess: (filing) => {
      queryClient.setQueryData(["itr-filing", ay], filing);
      setDirty(false);
      setSavedAt(new Date());
      return queryClient.invalidateQueries({ queryKey: ["itr-summary", ay] });
    },
  });

  const rereadMutation = useMutation<ItrFilingOut, ApiError, void>({
    mutationFn: () => rereadDocuments(ay),
    onSuccess: (filing) => {
      queryClient.setQueryData(["itr-filing", ay], filing);
      setLocalDraft(null);
      setDirty(false);
      queryClient.invalidateQueries({ queryKey: ["itr-summary", ay] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  function handleChange(next: ItrDraftData) {
    setLocalDraft(next);
    setDirty(true);
  }

  function goTo(target: number) {
    if (draft && dirty && !saveMutation.isPending) {
      saveMutation.mutate(draft);
    }
    setStep(target);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function saveAndContinue() {
    if (!draft) return;
    saveMutation.mutate(draft, {
      onSuccess: () => {
        setStep((current) => Math.min(current + 1, LAST_STEP));
        window.scrollTo({ top: 0, behavior: "smooth" });
      },
    });
  }

  const saveStatus = saveMutation.isPending
    ? "Saving…"
    : saveMutation.isError
      ? null
      : dirty
        ? "Unsaved changes"
        : savedAt
          ? `Saved at ${savedAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`
          : filingQuery.data
            ? "All changes saved"
            : null;

  const loadError = yearsQuery.error ?? filingQuery.error;
  const sources =
    draft && filingQuery.data ? activeSources(filingQuery.data.field_sources ?? {}, filingQuery.data.data, draft) : {};
  const sourceDocs = [...new Set(Object.values(sources))];

  return (
    <AppShell title="ITR Filing">
      <p className="mb-2 text-sm text-muted">
        Prepare your ITR-1 (Sahaj) return and download the JSON to upload on the Income Tax portal.
      </p>
      {yearInfo && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            AY {yearInfo.assessment_year} (FY {yearInfo.financial_year}) · Due date{" "}
            <span className="text-foreground">{formatDate(yearInfo.due_date)}</span> · Belated return deadline{" "}
            <span className="text-foreground">{formatDate(yearInfo.belated_deadline)}</span>
          </p>
          {draft && (
            <div className="flex flex-col items-start gap-1 sm:items-end">
              <Button
                variant="secondary"
                size="sm"
                disabled={rereadMutation.isPending || saveMutation.isPending || dirty}
                title={dirty ? "Save your changes first" : undefined}
                onClick={() => rereadMutation.mutate()}
              >
                <RefreshCw className={rereadMutation.isPending ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                {rereadMutation.isPending ? "Reading documents…" : "Re-read documents"}
              </Button>
              {rereadMutation.isError && <p className="text-sm text-error">{rereadMutation.error.message}</p>}
              {rereadMutation.isSuccess && (
                <p className="text-sm text-muted">Updated from your documents. Your own edits were kept.</p>
              )}
            </div>
          )}
        </div>
      )}

      {loadError ? (
        <ErrorState
          title="Couldn't load your return"
          description={loadError.message}
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => (yearsQuery.error ? yearsQuery.refetch() : filingQuery.refetch())}
            >
              Try again
            </Button>
          }
        />
      ) : yearsQuery.isSuccess && !yearInfo ? (
        <ErrorState title="No assessment year is open for filing" />
      ) : !draft ? (
        <LoadingState />
      ) : (
        <>
          <Stepper current={step} onSelect={goTo} />

          {sourceDocs.length > 0 && step < LAST_STEP && (
            <div className="mb-6">
              <Notice title="Auto-filled from your documents">
                {Object.keys(sources).length} field{Object.keys(sources).length === 1 ? " was" : "s were"} filled
                from your {sourceDocs.join(", ")}. Check them, and complete the fields marked * — they&apos;re
                required. Upload more in{" "}
                <Link href="/documents" className="font-medium text-link underline">
                  Documents
                </Link>
                .
              </Notice>
            </div>
          )}

          <FieldSourcesProvider value={sources}>
            {step === 1 && <PersonalStep draft={draft} onChange={handleChange} />}
            {step === 2 && <IncomeStep draft={draft} onChange={handleChange} />}
            {step === 3 && <DeductionsStep draft={draft} onChange={handleChange} />}
            {step === 4 && <TaxesPaidStep draft={draft} onChange={handleChange} />}
            {step === 5 && (
              <RegimeBankStep
                draft={draft}
                onChange={handleChange}
                oldRegimeAllowed={summaryQuery.data?.old_regime_allowed ?? true}
              />
            )}
          </FieldSourcesProvider>
          {step === 6 && (
            <ReviewStep
              ay={ay}
              summary={summaryQuery.data}
              isLoading={summaryQuery.isLoading}
              error={summaryQuery.error}
              onRetry={() => summaryQuery.refetch()}
              onJump={goTo}
              saving={saveMutation.isPending || dirty}
            />
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-col gap-1">
              {saveMutation.isError && (
                <p className="text-sm text-error">
                  {saveMutation.error.message || "Couldn't save your changes. Please try again."}
                </p>
              )}
              {saveStatus && <p className="text-sm text-muted">{saveStatus}</p>}
            </div>
            <div className="flex gap-2">
              {step > 1 && (
                <Button variant="secondary" onClick={() => goTo(step - 1)}>
                  Back
                </Button>
              )}
              {step < LAST_STEP && (
                <Button variant="primary" onClick={saveAndContinue} disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? "Saving…" : "Save & continue"}
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </AppShell>
  );
}

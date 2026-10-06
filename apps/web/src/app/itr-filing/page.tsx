"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Bot, RefreshCw, UserRoundSearch } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { AutofillIntro } from "@/components/itr/AutofillIntro";
import { DeductionsStep } from "@/components/itr/DeductionsStep";
import { IncomeStep } from "@/components/itr/IncomeStep";
import { PersonalStep } from "@/components/itr/PersonalStep";
import { RegimeSection, VerificationSection } from "@/components/itr/RegimeBankStep";
import { ReviewStep } from "@/components/itr/ReviewStep";
import { Stepper } from "@/components/itr/Stepper";
import { TaxesPaidStep } from "@/components/itr/TaxesPaidStep";
import { FieldSourcesProvider, Notice, SectionModeProvider } from "@/components/itr/fields";
import { LAST_STEP, STEPS, stepForField } from "@/components/itr/options";
import { TaxChatWidget } from "@/components/tax/TaxChatWidget";
import { useAuth } from "@/lib/auth/AuthContext";
import type { User } from "@/lib/auth/types";
import { ApiError } from "@/lib/api-client";
import { getAssessmentYears, getItrFiling, getItrSummary, rereadDocuments, saveItrFiling } from "@/lib/itr/api";
import type { ItrDraftData, ItrFilingOut, ItrSummary } from "@/lib/itr/types";

type View = "intro" | "steps" | "fix";

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

function introKey(ay: string) {
  return `moneymitra:itr-intro-done:${ay}`;
}

function introDone(ay: string): boolean {
  try {
    return window.localStorage.getItem(introKey(ay)) === "1";
  } catch {
    return false;
  }
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

function HelpCards() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="flex items-start gap-3 p-4">
        <Bot className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div>
          <p className="font-semibold text-foreground">Need help?</p>
          <p className="text-sm text-muted">Ask the MoneyMitra tax assistant — use the chat button at the bottom right.</p>
        </div>
      </Card>
      <Card className="flex items-start gap-3 p-4">
        <UserRoundSearch className="mt-0.5 h-5 w-5 shrink-0 text-foreground" />
        <div>
          <p className="flex flex-wrap items-center gap-2 font-semibold text-foreground">
            Expert filing
            <Badge variant="neutral" className="px-2 py-0.5 text-xs">
              Coming soon
            </Badge>
          </p>
          <p className="text-sm text-muted">Let a tax expert review and file your return for you.</p>
        </div>
      </Card>
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
  const [view, setView] = useState<View | null>(null);
  const [localDraft, setLocalDraft] = useState<ItrDraftData | null>(null);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);

  // Until the user edits something, the draft mirrors the server copy.
  const draft = localDraft ?? (filingQuery.data ? withProfileDefaults(filingQuery.data.data, user) : null);

  // Section badges ("Details added" / "N to fix") need the summary on every step.
  const summaryQuery = useQuery({
    queryKey: ["itr-summary", ay],
    queryFn: () => getItrSummary(ay),
    enabled: !!ay && !!filingQuery.data,
  });
  const summary: ItrSummary | undefined = summaryQuery.data;

  // First visit with an empty draft starts on the auto-fill screen.
  const hasSources = Object.keys(filingQuery.data?.field_sources ?? {}).length > 0;
  const currentView: View =
    view ?? (filingQuery.data && !hasSources && !filingQuery.data.data.personal.pan && !introDone(ay) ? "intro" : "steps");

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

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    document.querySelector("main")?.scrollTo({ top: 0, behavior: "smooth" });
  }

  function finishIntro() {
    try {
      window.localStorage.setItem(introKey(ay), "1");
    } catch {
      // Remembering the choice is a convenience only.
    }
    setView("steps");
  }

  function goTo(target: number) {
    if (draft && dirty && !saveMutation.isPending) {
      saveMutation.mutate(draft);
    }
    setView("steps");
    setStep(target);
    scrollTop();
  }

  function saveAndContinue() {
    if (!draft) return;
    saveMutation.mutate(draft, {
      onSuccess: () => {
        setStep((current) => Math.min(current + 1, LAST_STEP));
        scrollTop();
      },
    });
  }

  function fixAndContinue() {
    if (!draft) return;
    saveMutation.mutate(draft, {
      onSuccess: async () => {
        const fresh = await queryClient.fetchQuery({ queryKey: ["itr-summary", ay], queryFn: () => getItrSummary(ay) });
        if (fresh.missing_fields.length === 0) {
          setView("steps");
          setStep(LAST_STEP);
        }
        scrollTop();
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
  const issueFields = [...(summary?.missing_fields ?? []), ...(summary?.eligibility_issues ?? [])].map((i) => i.field);
  const issueSteps = new Set(issueFields.map(stepForField).filter((s): s is number => s !== null));

  const stepBody = (target: number) => {
    if (!draft) return null;
    switch (target) {
      case 1:
        return <PersonalStep draft={draft} onChange={handleChange} />;
      case 2:
        return <IncomeStep draft={draft} onChange={handleChange} />;
      case 3:
        return <DeductionsStep draft={draft} onChange={handleChange} />;
      default:
        return (
          <div className="flex flex-col gap-4">
            <RegimeSection draft={draft} onChange={handleChange} summary={summary} />
            <TaxesPaidStep draft={draft} onChange={handleChange} />
            <VerificationSection draft={draft} onChange={handleChange} />
          </div>
        );
    }
  };

  const actions = (
    <div className="flex flex-col gap-2">
      {saveMutation.isError && (
        <p className="text-sm text-error">{saveMutation.error.message || "Couldn't save your changes. Please try again."}</p>
      )}
      {currentView === "fix" ? (
        <Button variant="primary" onClick={fixAndContinue} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? "Saving…" : "Fix and continue"}
          <ArrowRight className="h-4 w-4" />
        </Button>
      ) : (
        step < LAST_STEP && (
          <Button variant="primary" onClick={saveAndContinue} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Saving…" : `Go to ${STEPS[step].label}`}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )
      )}
      {currentView === "steps" && step > 1 && (
        <Button variant="secondary" onClick={() => goTo(step - 1)}>
          Back
        </Button>
      )}
      {saveStatus && <p className="text-center text-sm text-muted">{saveStatus}</p>}
    </div>
  );

  return (
    <AppShell title="ITR Filing">
      {yearInfo && (
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted">
            ITR-1 (Sahaj) · AY {yearInfo.assessment_year} (FY {yearInfo.financial_year}) · Due date{" "}
            <span className="text-foreground">{formatDate(yearInfo.due_date)}</span> · Belated return deadline{" "}
            <span className="text-foreground">{formatDate(yearInfo.belated_deadline)}</span>
          </p>
          {draft && currentView !== "intro" && (
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
      ) : currentView === "intro" ? (
        <AutofillIntro onContinue={finishIntro} />
      ) : (
        <FieldSourcesProvider value={sources}>
          {currentView === "steps" && <Stepper current={step} onSelect={goTo} issueSteps={issueSteps} />}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="flex min-w-0 flex-col gap-4">
              {currentView === "fix" ? (
                <>
                  <div className="flex items-start gap-3">
                    <Button variant="secondary" size="sm" aria-label="Back to Tax Summary" onClick={() => goTo(LAST_STEP)}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <h2 className="text-h2">A few details are missing. Take a minute to complete them!</h2>
                      <p className="text-sm text-muted">Only the sections that need your input are shown.</p>
                    </div>
                  </div>
                  <SectionModeProvider value={{ issueFields, onlyIssues: true }}>
                    {[1, 2, 3, 4].map((s) => (
                      <div key={s} className="flex flex-col gap-4">
                        {stepBody(s)}
                      </div>
                    ))}
                  </SectionModeProvider>
                  {summary && summary.warnings.length > 0 && (
                    <Notice variant="warning" title="Smart checks">
                      <ul className="list-disc space-y-1 pl-5">
                        {summary.warnings.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </Notice>
                  )}
                </>
              ) : (
                <>
                  {sourceDocs.length > 0 && step < LAST_STEP && (
                    <Notice title="Auto-filled from your documents">
                      {Object.keys(sources).length} field{Object.keys(sources).length === 1 ? " was" : "s were"} filled
                      from your {sourceDocs.join(", ")}. Check them, and complete the fields marked * — they&apos;re
                      required. Upload more in{" "}
                      <Link href="/documents" className="font-medium text-link underline">
                        Documents
                      </Link>
                      .
                    </Notice>
                  )}
                  <SectionModeProvider value={{ issueFields, onlyIssues: false }}>{stepBody(step)}</SectionModeProvider>
                  {step === LAST_STEP && (
                    <ReviewStep
                      ay={ay}
                      summary={summary}
                      isLoading={summaryQuery.isLoading}
                      error={summaryQuery.error}
                      onRetry={() => summaryQuery.refetch()}
                      onJump={goTo}
                      onFix={() => {
                        setView("fix");
                        scrollTop();
                      }}
                      saving={saveMutation.isPending || dirty}
                    />
                  )}
                </>
              )}
            </div>

            <aside className="flex flex-col gap-4 xl:sticky xl:top-0 xl:self-start">
              {actions}
              <div className="hidden xl:block">
                <HelpCards />
              </div>
            </aside>
          </div>
        </FieldSourcesProvider>
      )}

      <TaxChatWidget />
    </AppShell>
  );
}

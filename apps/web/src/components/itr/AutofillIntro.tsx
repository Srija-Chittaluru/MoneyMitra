"use client";

import Link from "next/link";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, FileUp, Landmark } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Dialog } from "@/components/ui/Dialog";
import { listDocuments } from "@/lib/documents/api";
import type { DocumentCategory } from "@/lib/documents/types";

const AUTOFILL_DOCS: { category: DocumentCategory; name: string; fills: string }[] = [
  { category: "form16", name: "Form 16", fills: "Salary, exemptions, employer TDS, deductions" },
  { category: "ais", name: "AIS", fills: "Personal details, address, interest, dividends, other TDS" },
  { category: "payslips", name: "Payslips (March)", fills: "Full-year salary, HRA inputs" },
  { category: "form26as", name: "Form 26AS", fills: "TDS from every deductor — and a check of your TDS claims" },
  { category: "pan", name: "PAN card (PDF)", fills: "Name, father's name, date of birth" },
];

const BENEFITS = ["Eliminate manual data entry", "Generate a more accurate tax summary", "Auto-fill personal and salary details"];

/** First screen of the flow: auto-fill from documents (or, later, the Income Tax Department). */
export function AutofillIntro({ onContinue }: { onContinue: () => void }) {
  const [confirmSkip, setConfirmSkip] = useState(false);
  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: listDocuments });
  const uploaded = new Set(
    (documentsQuery.data ?? []).filter((d) => d.extraction_status === "extracted").map((d) => d.category),
  );
  const anyUploaded = uploaded.size > 0;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-h2">Auto-fill your return</h2>
        <p className="mt-1 text-sm text-muted">Most people finish in minutes when their details are filled in for them.</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <Card className="flex flex-col gap-4 bg-card border-line">
          <p className="text-h2">Why auto-fill?</p>
          <ul className="flex flex-col gap-3 text-sm">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {b}
              </li>
            ))}
          </ul>
          <p className="mt-auto text-sm text-muted">
            Values are only filled into empty fields and are tagged with their source, so you can check them.
          </p>
        </Card>

        <Card className="flex flex-col gap-4 bg-card border-line">
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-field">
              <FileUp className="h-4 w-4" />
            </span>
            <div>
              <p className="font-semibold text-foreground">Upload your documents</p>
              <p className="text-sm text-muted">Each document fills these parts of your return:</p>
            </div>
          </div>
          <ul className="flex flex-col divide-y divide-line">
            {AUTOFILL_DOCS.map((doc) => {
              const done = uploaded.has(doc.category);
              return (
                <li key={doc.category} className="flex items-start gap-3 py-2">
                  {done ? (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  ) : (
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {doc.name} {done && <span className="font-normal text-success">· read</span>}
                    </p>
                    <p className="text-sm text-muted">{doc.fills}</p>
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Link
              href="/documents"
              className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              {anyUploaded ? "Upload more documents" : "Upload documents"}
            </Link>
            {anyUploaded && (
              <Button variant="secondary" onClick={onContinue}>
                Continue with auto-filled details
              </Button>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md bg-field px-3 py-3">
            <span className="flex items-center gap-2 text-sm text-foreground">
              <Landmark className="h-4 w-4" /> Fetch from Income Tax Department
            </span>
            <Badge variant="neutral" className="px-2 py-0.5 text-xs">
              Coming soon
            </Badge>
          </div>
        </Card>
      </div>

      {!anyUploaded && (
        <button
          type="button"
          onClick={() => setConfirmSkip(true)}
          className="self-center text-sm font-semibold text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
        >
          Skip — I&apos;ll fill in the details myself
        </button>
      )}

      <Dialog open={confirmSkip} onClose={() => setConfirmSkip(false)} title="Skip auto-fill?">
        <p className="mb-3 text-sm text-muted">Auto-fill reads your tax documents and fills your return in seconds.</p>
        <ul className="mb-4 flex flex-col gap-2 text-sm text-foreground">
          {BENEFITS.map((b) => (
            <li key={b} className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {b}
            </li>
          ))}
        </ul>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            onClick={() => {
              setConfirmSkip(false);
              onContinue();
            }}
          >
            Yes, skip
          </Button>
          <Link
            href="/documents"
            className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-5 font-semibold text-primary-foreground hover:opacity-90"
          >
            No, use auto-fill
          </Link>
        </div>
      </Dialog>
    </div>
  );
}

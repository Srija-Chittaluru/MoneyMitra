import Link from "next/link";
import { Check, CircleSlash } from "lucide-react";
import { Card } from "@/components/ui/Card";
import type { DocumentsReport } from "@/lib/recommendations/types";

/** Shows which uploaded documents the advice is based on, and why any others weren't used. */
export function DocumentsPanel({ documents }: { documents: DocumentsReport }) {
  if (documents.analysed.length === 0 && documents.skipped.length === 0) return null;

  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-h2">Your documents</h3>
        <Link href="/documents" className="text-sm text-link">
          Manage documents
        </Link>
      </div>

      <ul className="flex flex-col gap-3">
        {documents.analysed.map((doc) => (
          <li key={`${doc.category}-${doc.file_name}`} className="flex items-start gap-3">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
            <p className="text-sm text-foreground">
              <span className="font-medium">{doc.label}</span>
              <span className="text-muted"> · {doc.file_name} · used for your recommendations</span>
            </p>
          </li>
        ))}
        {documents.skipped.map((doc) => (
          <li key={`${doc.category}-${doc.file_name}`} className="flex items-start gap-3">
            <CircleSlash className="mt-0.5 h-4 w-4 shrink-0 text-muted" strokeWidth={2} />
            <p className="text-sm text-muted">
              <span className="font-medium text-foreground">{doc.file_name}</span> · not used: {doc.reason}
            </p>
          </li>
        ))}
      </ul>
    </Card>
  );
}

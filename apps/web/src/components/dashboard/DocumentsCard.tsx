import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/cn";
import type { DocumentStatus, Form16Status } from "@/lib/dashboard/state";
import { SectionError, SectionSkeleton } from "./SectionStatus";

interface DocumentsCardProps {
  status: "loading" | "error" | "ready";
  documents: DocumentStatus | undefined;
  onRetry: () => void;
  className?: string;
}

const FORM16_BADGES: Record<Form16Status, { variant: "success" | "warning" | "neutral"; label: string }> = {
  processed: { variant: "success", label: "Processed" },
  unreadable: { variant: "warning", label: "Couldn't read" },
  uploaded: { variant: "neutral", label: "Uploaded" },
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      {children}
    </div>
  );
}

export function DocumentsCard({ status, documents, onRetry, className }: DocumentsCardProps) {
  return (
    <Card className={cn("border-line", className)}>
      <h3 className="text-h2 mb-4">Document status</h3>

      {status === "loading" || !documents ? (
        status === "error" ? (
          <SectionError message="We couldn't load your documents." onRetry={onRetry} />
        ) : (
          <SectionSkeleton />
        )
      ) : (
        <>
          <div className="flex flex-col gap-3 text-sm">
            <Row label="Form 16">
              {documents.form16 ? (
                <Badge variant={FORM16_BADGES[documents.form16].variant}>
                  {FORM16_BADGES[documents.form16].label}
                </Badge>
              ) : (
                <span className="text-muted">Not uploaded</span>
              )}
            </Row>
            <Row label="Payslips">
              <span>{documents.payslips} uploaded</span>
            </Row>
            <Row label="Tax proofs">
              <span>{documents.taxProofs} uploaded</span>
            </Row>
            {documents.other > 0 && (
              <Row label="Other documents">
                <span>{documents.other} uploaded</span>
              </Row>
            )}
          </div>
          <Link href="/documents">
            <Button variant="secondary" size="sm" className="mt-4 w-full">
              {documents.total === 0 ? "Upload documents" : "Manage documents"}
            </Button>
          </Link>
        </>
      )}
    </Card>
  );
}

import { FileText, CheckCircle2 } from "lucide-react";
import { Badge } from "./Badge";
import type { DocumentStatus } from "@/lib/mock/documents";

interface DocumentRowProps {
  name: string;
  uploadedAt: string;
  status: DocumentStatus;
  extracted: boolean;
}

const STATUS_VARIANT: Record<DocumentStatus, "success" | "warning" | "error" | "neutral"> = {
  processed: "success",
  processing: "warning",
  pending: "neutral",
  failed: "error",
};

const STATUS_LABEL: Record<DocumentStatus, string> = {
  processed: "Processed",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
};

export function DocumentRow({ name, uploadedAt, status, extracted }: DocumentRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <FileText className="h-5 w-5 shrink-0 text-muted" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{name}</p>
        <p className="text-sm text-muted">Uploaded {uploadedAt}</p>
      </div>
      {extracted && (
        <span className="hidden items-center gap-1 text-sm text-success sm:flex">
          <CheckCircle2 className="h-4 w-4" /> Extracted
        </span>
      )}
      <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>
    </div>
  );
}

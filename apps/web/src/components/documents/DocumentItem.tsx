"use client";

import { useState } from "react";
import { Download, Eye, FileJson, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/cn";
import { getDocumentFile } from "@/lib/documents/api";
import type { UploadedDocument } from "@/lib/documents/types";

const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" });

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function FileIcon({ contentType }: { contentType: string }) {
  const className = "h-5 w-5 shrink-0 text-muted";
  if (contentType.startsWith("image/")) return <ImageIcon className={className} strokeWidth={1.75} />;
  if (contentType === "application/json") return <FileJson className={className} strokeWidth={1.75} />;
  return <FileText className={className} strokeWidth={1.75} />;
}

const EXTRACTION_BADGE: Partial<
  Record<UploadedDocument["extraction_status"], { label: string; variant: "success" | "warning" | "neutral" }>
> = {
  extracted: { label: "Details read", variant: "success" },
  nothing_found: { label: "No details found", variant: "neutral" },
  unsupported: { label: "Not read", variant: "warning" },
};

function IconButton({
  label,
  icon: Icon,
  onClick,
  danger,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring disabled:pointer-events-none disabled:opacity-50",
        danger ? "hover:text-error" : "hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

interface DocumentItemProps {
  document: UploadedDocument;
  onDelete: (document: UploadedDocument) => void;
}

export function DocumentItem({ document: doc, onDelete }: DocumentItemProps) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const badge = EXTRACTION_BADGE[doc.extraction_status];

  async function withFile(action: (url: string) => void) {
    setBusy(true);
    setError(null);
    try {
      const url = URL.createObjectURL(await getDocumentFile(doc.id));
      action(url);
      // Give the new tab / download time to read the blob before releasing it.
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      setError("Could not open the file.");
    } finally {
      setBusy(false);
    }
  }

  function open(url: string, download: boolean) {
    const link = window.document.createElement("a");
    link.href = url;
    if (download) link.download = doc.file_name;
    else link.target = "_blank";
    link.rel = "noopener";
    link.click();
  }

  return (
    <div className="flex items-center gap-3 py-3">
      <FileIcon contentType={doc.content_type} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground" title={doc.file_name}>
          {doc.file_name}
        </p>
        <p className="text-sm text-muted">
          Uploaded {dateFormatter.format(new Date(doc.uploaded_at))} · {formatBytes(doc.size_bytes)}
        </p>
        {badge && (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <Badge variant={badge.variant} className="px-2 py-0.5 text-xs">
              {badge.label}
            </Badge>
            {doc.extraction_message && <span className="text-sm text-muted">{doc.extraction_message}</span>}
          </div>
        )}
        {error && <p className="text-sm text-error">{error}</p>}
      </div>
      <div className="flex shrink-0 items-center">
        <IconButton label={`View ${doc.file_name}`} icon={Eye} disabled={busy} onClick={() => withFile((u) => open(u, false))} />
        <IconButton
          label={`Download ${doc.file_name}`}
          icon={Download}
          disabled={busy}
          onClick={() => withFile((u) => open(u, true))}
        />
        <IconButton label={`Delete ${doc.file_name}`} icon={Trash2} danger onClick={() => onDelete(doc)} />
      </div>
    </div>
  );
}

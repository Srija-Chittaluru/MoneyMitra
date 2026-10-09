"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { ApiError } from "@/lib/api-client";
import { uploadDocument } from "@/lib/documents/api";
import { DOCUMENT_DEPENDENT_QUERIES } from "@/lib/documents/queries";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/types";
import type { DocumentCategory, UploadedDocument } from "@/lib/documents/types";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png,.json,application/pdf,image/jpeg,image/png,application/json";

interface UploadDialogProps {
  open: boolean;
  initialCategory: DocumentCategory;
  onClose: () => void;
}

export function UploadDialog({ open, initialCategory, onClose }: UploadDialogProps) {
  // Remounted per open (see `key` in the page), so initial state is fresh each time.
  const [category, setCategory] = useState<DocumentCategory>(initialCategory);
  const [file, setFile] = useState<File | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const mutation = useMutation<UploadedDocument, ApiError, void>({
    mutationFn: () => uploadDocument(category, file as File),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      // Uploads can auto-fill the ITR draft.
      queryClient.invalidateQueries({ queryKey: ["itr-filing"] });
      queryClient.invalidateQueries({ queryKey: ["itr-summary"] });
      // ...and everything computed from them: the dashboard, recommendations and tax plan.
      for (const key of DOCUMENT_DEPENDENT_QUERIES) queryClient.invalidateQueries({ queryKey: [key] });
      onClose();
    },
  });

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldError(null);
    if (!file) {
      setFieldError("Choose a file to upload.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setFieldError("File is larger than 10 MB.");
      return;
    }
    mutation.mutate();
  }

  return (
    <Dialog open={open} onClose={onClose} title="Upload document">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Select
          id="document-category"
          label="Document type"
          value={category}
          onChange={(e) => setCategory(e.target.value as DocumentCategory)}
          className="bg-field border-line"
        >
          {DOCUMENT_CATEGORIES.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="document-file" className="text-sm font-medium text-foreground">
            File
          </label>
          <input
            id="document-file"
            type="file"
            accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-line bg-field text-sm text-foreground file:mr-3 file:h-11 file:border-0 file:bg-hover file:px-4 file:font-semibold file:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          />
          <p className="text-sm text-muted">
            PDF, JPG or PNG up to 10 MB (photos and scans are read with OCR). AIS can also be the JSON download.
            Each file is checked to be the right document, for your PAN and for FY 2025-26.
          </p>
        </div>

        {(fieldError || mutation.isError) && (
          <p className="text-sm text-error">
            {fieldError ?? mutation.error?.message ?? "Upload failed. Please try again."}
          </p>
        )}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={mutation.isPending}>
            {mutation.isPending ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

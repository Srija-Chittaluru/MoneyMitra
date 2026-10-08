"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FolderOpen, Upload } from "lucide-react";
import { AppShell } from "@/components/shell/AppShell";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { DocumentItem } from "@/components/documents/DocumentItem";
import { UploadDialog } from "@/components/documents/UploadDialog";
import { ApiError } from "@/lib/api-client";
import { deleteDocument, listDocuments } from "@/lib/documents/api";
import { DOCUMENT_DEPENDENT_QUERIES } from "@/lib/documents/queries";
import { DOCUMENT_CATEGORIES } from "@/lib/documents/types";
import type { DocumentCategory, UploadedDocument } from "@/lib/documents/types";

export default function DocumentsPage() {
  const queryClient = useQueryClient();
  const documentsQuery = useQuery({ queryKey: ["documents"], queryFn: listDocuments });

  const [uploadCategory, setUploadCategory] = useState<DocumentCategory | null>(null);
  // Bumped on each open so the dialog remounts with a clean form.
  const [uploadKey, setUploadKey] = useState(0);
  const [pendingDelete, setPendingDelete] = useState<UploadedDocument | null>(null);

  const deleteMutation = useMutation<void, ApiError, string>({
    mutationFn: deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      // A deleted document changes the ITR draft's source figures and everything computed from them.
      queryClient.invalidateQueries({ queryKey: ["itr-filing"] });
      queryClient.invalidateQueries({ queryKey: ["itr-summary"] });
      for (const key of DOCUMENT_DEPENDENT_QUERIES) queryClient.invalidateQueries({ queryKey: [key] });
      setPendingDelete(null);
    },
  });

  function openUpload(category: DocumentCategory) {
    setUploadKey((k) => k + 1);
    setUploadCategory(category);
  }

  function closeDelete() {
    setPendingDelete(null);
    deleteMutation.reset();
  }

  const documents = documentsQuery.data ?? [];

  return (
    <AppShell title="Documents">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-body text-muted">
          Keep your tax documents in one place. Details from your PAN, Form 16, AIS and payslips are filled into
          ITR Filing automatically.
        </p>
        <Button variant="primary" size="sm" className="w-full sm:w-auto" onClick={() => openUpload("pan")}>
          <Upload className="h-4 w-4" />
          Upload document
        </Button>
      </div>

      {documentsQuery.isLoading ? (
        <div className="flex flex-col gap-6">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="flex flex-col gap-3 bg-card border-line">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-4 w-64 max-w-full" />
              <Skeleton className="h-10 w-full" />
            </Card>
          ))}
        </div>
      ) : documentsQuery.isError ? (
        <ErrorState
          title="Could not load your documents"
          description={documentsQuery.error.message}
          action={
            <Button variant="secondary" size="sm" onClick={() => documentsQuery.refetch()}>
              Try again
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:gap-6 xl:grid-cols-2">
          {DOCUMENT_CATEGORIES.map((category) => {
            const items = documents.filter((d) => d.category === category.id);
            return (
              <Card key={category.id} className="min-w-0 bg-card border-line p-4 sm:p-6">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-h2">{category.name}</h3>
                      {items.length > 0 && <Badge variant="neutral">{items.length}</Badge>}
                    </div>
                    <p className="text-sm text-muted">{category.description}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0"
                    aria-label={`Upload ${category.name}`}
                    onClick={() => openUpload(category.id)}
                  >
                    <Upload className="h-4 w-4" />
                    <span className="hidden sm:inline">Upload</span>
                  </Button>
                </div>
                {items.length === 0 ? (
                  <EmptyState
                    icon={FolderOpen}
                    title="No documents yet"
                    description={`Upload your ${category.name} to see it here.`}
                  />
                ) : (
                  <div className="divide-y divide-line">
                    {items.map((doc) => (
                      <DocumentItem key={doc.id} document={doc} onDelete={setPendingDelete} />
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <UploadDialog
        key={uploadKey}
        open={uploadCategory !== null}
        initialCategory={uploadCategory ?? "pan"}
        onClose={() => setUploadCategory(null)}
      />

      <Dialog open={pendingDelete !== null} onClose={closeDelete} title="Delete document?">
        <p className="mb-4 break-words text-sm text-muted">
          {pendingDelete?.file_name} will be permanently deleted.
        </p>
        {deleteMutation.isError && <p className="mb-4 text-sm text-error">{deleteMutation.error.message}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={closeDelete}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={deleteMutation.isPending}
            onClick={() => pendingDelete && deleteMutation.mutate(pendingDelete.id)}
          >
            {deleteMutation.isPending ? "Deleting…" : "Delete"}
          </Button>
        </div>
      </Dialog>
    </AppShell>
  );
}

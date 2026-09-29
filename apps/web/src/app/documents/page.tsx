import { AppShell } from "@/components/shell/AppShell";
import { DemoBanner } from "@/components/ui/DemoBanner";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { DocumentRow } from "@/components/ui/DocumentRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { mockDocumentCategories } from "@/lib/mock";
import { Upload, FolderOpen } from "lucide-react";

export default function DocumentsPage() {
  return (
    <AppShell title="Documents">
      <DemoBanner />

      <div className="mb-6 flex items-center justify-between">
        <p className="text-body text-muted">
          Upload here is UI-only for now — no files are actually processed.
        </p>
        <Button variant="primary" size="sm">
          <Upload className="h-4 w-4" />
          Upload document
        </Button>
      </div>

      <div className="flex flex-col gap-6">
        {mockDocumentCategories.map((category) => (
          <Card key={category.id}>
            <div className="mb-3">
              <h3 className="text-h2">{category.name}</h3>
              <p className="text-sm text-muted">{category.description}</p>
            </div>
            {category.documents.length === 0 ? (
              <EmptyState
                icon={FolderOpen}
                title="No documents yet"
                description={`Upload a document to this category to see it here.`}
              />
            ) : (
              <div className="divide-y divide-border">
                {category.documents.map((doc) => (
                  <DocumentRow key={doc.id} {...doc} />
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
    </AppShell>
  );
}

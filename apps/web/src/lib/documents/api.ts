import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import type { DocumentCategory, UploadedDocument } from "./types";

export function listDocuments() {
  return apiFetch<UploadedDocument[]>("/api/v1/documents");
}

export function uploadDocument(category: DocumentCategory, file: File) {
  const body = new FormData();
  body.append("category", category);
  body.append("file", file);
  return apiFetch<UploadedDocument>("/api/v1/documents", { method: "POST", body });
}

export function getDocumentFile(id: string) {
  return apiFetchBlob(`/api/v1/documents/${id}/file`);
}

export function deleteDocument(id: string) {
  return apiFetch<void>(`/api/v1/documents/${id}`, { method: "DELETE" });
}

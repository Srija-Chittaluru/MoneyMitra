import { apiFetch, apiFetchBlob } from "@/lib/api-client";
import type {
  AssessmentYearInfo,
  ItrDraftData,
  ItrExport,
  ItrFilingOut,
  ItrSummary,
} from "./types";

export function getAssessmentYears() {
  return apiFetch<AssessmentYearInfo[]>("/api/v1/itr/assessment-years");
}

export function getItrFiling(ay: string) {
  return apiFetch<ItrFilingOut>(`/api/v1/itr/filings/${ay}`);
}

export function saveItrFiling(ay: string, data: ItrDraftData) {
  return apiFetch<ItrFilingOut>(`/api/v1/itr/filings/${ay}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function getItrSummary(ay: string) {
  return apiFetch<ItrSummary>(`/api/v1/itr/filings/${ay}/summary`);
}

export function exportItr(ay: string) {
  return apiFetch<ItrExport>(`/api/v1/itr/filings/${ay}/export`, { method: "POST" });
}

export function rereadDocuments(ay: string) {
  return apiFetch<ItrFilingOut>(`/api/v1/itr/filings/${ay}/reread-documents`, { method: "POST" });
}

export function exportItrPdf(ay: string) {
  return apiFetchBlob(`/api/v1/itr/filings/${ay}/export/pdf`);
}

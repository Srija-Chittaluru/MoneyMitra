/**
 * Turns what the backend knows about the user into what the dashboard may
 * show. Pure functions, no demo values: a figure exists here only if the data
 * it is calculated from exists, and otherwise is `null` so the UI renders an
 * empty state instead of a number.
 */
import { DOCUMENT_CATEGORIES } from "@/lib/documents/types";
import type { DocumentCategory, UploadedDocument } from "@/lib/documents/types";
import type { Recommendation } from "@/lib/recommendations/types";
import type { DashboardSummary, RegimeChoice, SummarySource } from "./types";

export const SOURCE_LABELS: Record<SummarySource, string> = {
  itr_filing: "your ITR draft",
  tax_comparison: "your tax comparison",
};

/* ---------- Income & tax ---------- */

export interface IncomeFigure {
  amount: number;
  sourceLabel: string;
}

export interface EstimatedTaxFigure {
  amount: number;
  regime: "old" | "new";
}

export interface RegimeComparison {
  oldTax: number;
  newTax: number;
  better: RegimeChoice;
  /** How much the better regime saves; 0 when both cost the same. */
  savings: number;
}

export function deriveIncome(summary: DashboardSummary): IncomeFigure | null {
  if (summary.annual_income === null || summary.source === null) return null;
  return { amount: summary.annual_income, sourceLabel: SOURCE_LABELS[summary.source] };
}

export function deriveEstimatedTax(summary: DashboardSummary): EstimatedTaxFigure | null {
  return summary.estimated_tax ? { amount: summary.estimated_tax.amount, regime: summary.estimated_tax.regime } : null;
}

/** Only when both regimes could actually be calculated. */
export function deriveComparison(summary: DashboardSummary): RegimeComparison | null {
  const regime = summary.regime;
  if (regime === null) return null;
  return { oldTax: regime.old_tax, newTax: regime.new_tax, better: regime.better, savings: regime.difference };
}

/* ---------- Documents ---------- */

export type Form16Status = "processed" | "unreadable" | "uploaded";

export interface DocumentStatus {
  total: number;
  /** Null when no Form 16 has been uploaded. */
  form16: Form16Status | null;
  payslips: number;
  taxProofs: number;
  /** PAN, AIS, bills and anything else. */
  other: number;
}

function countOf(documents: UploadedDocument[], category: DocumentCategory): number {
  return documents.filter((doc) => doc.category === category).length;
}

export function deriveDocumentStatus(documents: UploadedDocument[]): DocumentStatus {
  const form16 = documents.filter((doc) => doc.category === "form16");
  let form16Status: Form16Status | null = null;
  if (form16.length > 0) {
    if (form16.some((doc) => doc.extraction_status === "extracted")) form16Status = "processed";
    else if (form16.some((doc) => doc.extraction_status === "nothing_found")) form16Status = "unreadable";
    else form16Status = "uploaded";
  }

  const payslips = countOf(documents, "payslips");
  const taxProofs = countOf(documents, "tax_proofs");
  return {
    total: documents.length,
    form16: form16Status,
    payslips,
    taxProofs,
    other: documents.length - form16.length - payslips - taxProofs,
  };
}

/* ---------- Recommendations ---------- */

/** Recommendation level 2+ is built on the user's own income, deductions or documents. */
const PERSONALISED_FROM_LEVEL = 2;

/**
 * The dashboard only surfaces advice derived from the user's own financial
 * data. Level 1 (profile / general guidance, e.g. "Make the most of Section
 * 80C") stays on the Recommendations page, where it is labelled as general.
 */
export function deriveDashboardRecommendations(recommendations: Recommendation[]): Recommendation[] {
  return recommendations.filter((rec) => rec.level >= PERSONALISED_FROM_LEVEL);
}

/* ---------- Recent activity: only things the user actually did ---------- */

export interface ActivityItem {
  id: string;
  kind: "document" | "tax";
  title: string;
  subtitle: string;
  at: string;
}

const CATEGORY_NAMES = Object.fromEntries(DOCUMENT_CATEGORIES.map((c) => [c.id, c.name])) as Record<
  DocumentCategory,
  string
>;

export function formatActivityDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function deriveActivity(
  summary: DashboardSummary | undefined,
  documents: UploadedDocument[] | undefined,
  limit = 4,
): ActivityItem[] {
  const items: ActivityItem[] = (documents ?? []).map((doc) => ({
    id: `document-${doc.id}`,
    kind: "document",
    title: doc.file_name,
    subtitle: `${CATEGORY_NAMES[doc.category]} uploaded · ${formatActivityDate(doc.uploaded_at)}`,
    at: doc.uploaded_at,
  }));

  if (summary?.updated_at && summary.source) {
    items.push({
      id: "tax-details",
      kind: "tax",
      title: summary.source === "itr_filing" ? "ITR draft updated" : "Tax comparison saved",
      subtitle: `Your tax figures · ${formatActivityDate(summary.updated_at)}`,
      at: summary.updated_at,
    });
  }

  return items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, limit);
}

/* ---------- The data states the dashboard is driven by ---------- */

export interface DashboardFlags {
  hasIncomeData: boolean;
  hasTaxData: boolean;
  hasDocuments: boolean;
  hasRecommendations: boolean;
  hasActivity: boolean;
}

export function deriveFlags(input: {
  summary: DashboardSummary | undefined;
  documents: UploadedDocument[] | undefined;
  recommendationCount: number | undefined;
}): DashboardFlags {
  const { summary, documents, recommendationCount } = input;
  return {
    hasIncomeData: summary ? deriveIncome(summary) !== null : false,
    hasTaxData: summary ? deriveEstimatedTax(summary) !== null : false,
    hasDocuments: (documents?.length ?? 0) > 0,
    hasRecommendations: (recommendationCount ?? 0) > 0,
    hasActivity: deriveActivity(summary, documents).length > 0,
  };
}

/**
 * MOCK DATA — for UI prototyping only. Real upload/extraction is Phase 4.
 */
export type DocumentStatus = "processed" | "processing" | "pending" | "failed";

export interface MockDocument {
  id: string;
  name: string;
  uploadedAt: string;
  status: DocumentStatus;
  extracted: boolean;
}

export interface MockDocumentCategory {
  id: string;
  name: string;
  description: string;
  documents: MockDocument[];
}

export const mockDocumentCategories: MockDocumentCategory[] = [
  {
    id: "form16",
    name: "Form 16",
    description: "Annual tax certificate from your employer",
    documents: [
      { id: "f16-2526", name: "Form16_AY2026-27.pdf", uploadedAt: "2026-06-12", status: "processed", extracted: true },
    ],
  },
  {
    id: "payslips",
    name: "Payslips",
    description: "Monthly salary slips",
    documents: [
      { id: "ps-aug", name: "Payslip_Aug_2026.pdf", uploadedAt: "2026-09-02", status: "processed", extracted: true },
      { id: "ps-jul", name: "Payslip_Jul_2026.pdf", uploadedAt: "2026-08-03", status: "processed", extracted: true },
      { id: "ps-jun", name: "Payslip_Jun_2026.pdf", uploadedAt: "2026-07-02", status: "processing", extracted: false },
    ],
  },
  {
    id: "tax-proofs",
    name: "Tax Proofs",
    description: "80C, 80D and other investment/insurance proofs",
    documents: [
      { id: "tp-lic", name: "LIC_Premium_Receipt.pdf", uploadedAt: "2026-04-18", status: "processed", extracted: true },
      { id: "tp-elss", name: "ELSS_Investment_Statement.pdf", uploadedAt: "2026-03-30", status: "pending", extracted: false },
    ],
  },
  {
    id: "bills",
    name: "Bills",
    description: "Utility bills and receipts",
    documents: [],
  },
  {
    id: "other",
    name: "Other Documents",
    description: "Anything else worth keeping on file",
    documents: [
      { id: "od-rent", name: "Rent_Agreement_2026.pdf", uploadedAt: "2026-04-01", status: "failed", extracted: false },
    ],
  },
];

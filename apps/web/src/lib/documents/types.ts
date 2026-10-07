export type DocumentCategory =
  | "pan"
  | "form16"
  | "ais"
  | "form26as"
  | "payslips"
  | "capital_gains"
  | "home_loan"
  | "tax_proofs"
  | "bills"
  | "other";

export interface UploadedDocument {
  id: string;
  category: DocumentCategory;
  file_name: string;
  content_type: string;
  size_bytes: number;
  uploaded_at: string;
  extraction_status: "extracted" | "nothing_found" | "unsupported" | "not_applicable";
  extraction_message: string | null;
}

export interface CategoryInfo {
  id: DocumentCategory;
  name: string;
  description: string;
}

export const DOCUMENT_CATEGORIES: CategoryInfo[] = [
  { id: "pan", name: "PAN Card", description: "Your Permanent Account Number card" },
  { id: "form16", name: "Form 16", description: "Annual tax certificate from your employer" },
  { id: "ais", name: "AIS", description: "Annual Information Statement from the e-filing portal" },
  { id: "form26as", name: "Form 26AS", description: "Tax deducted/collected at source — used to check every TDS claim" },
  { id: "payslips", name: "Payslips", description: "Monthly salary slips" },
  {
    id: "capital_gains",
    name: "Capital Gains & Trading Statements",
    description: "Broker capital-gains / tax P&L statements and mutual fund CAS",
  },
  { id: "home_loan", name: "Home Loan Certificate", description: "Interest certificate for your home loan" },
  { id: "tax_proofs", name: "Tax Proofs", description: "80C, 80D and other investment/insurance proofs" },
  { id: "bills", name: "Bills", description: "Utility bills and receipts" },
  { id: "other", name: "Other Documents", description: "Anything else worth keeping on file" },
];

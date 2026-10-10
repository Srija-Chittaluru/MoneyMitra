/**
 * Query keys whose data is computed from the user's uploaded documents. Upload
 * or delete a document and these must be refetched, or the dashboard,
 * recommendations and tax plan would keep showing figures from before the change.
 */
export const DOCUMENT_DEPENDENT_QUERIES = [
  "dashboard-summary",
  "dashboard-recommendations",
  "recommendations",
  "tax-plan",
] as const;

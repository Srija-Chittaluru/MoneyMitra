/**
 * MOCK DATA — for UI prototyping only. Dashboard-specific summary fields;
 * shared figures (tax comparison, transactions) live in their own mock
 * modules and are reused here rather than duplicated.
 */
export const mockDashboardSummary = {
  annualIncome: 1250000,
  documentStatus: {
    form16: "processed" as const,
    payslipsUploaded: 8,
    payslipsExpected: 12,
    taxProofsPending: 1,
  },
};

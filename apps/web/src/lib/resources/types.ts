export type AlertCategory = "itr_filing" | "advance_tax" | "investment_deadline";

export interface GovernmentAlert {
  title: string;
  date: string;
  description: string;
  category: AlertCategory;
  source: string | null;
}

export interface DeductionLimit {
  section: string;
  label: string;
  limit_general: number;
  limit_senior: number | null;
}

export interface Resources {
  alerts: GovernmentAlert[];
  deduction_limits: DeductionLimit[];
}

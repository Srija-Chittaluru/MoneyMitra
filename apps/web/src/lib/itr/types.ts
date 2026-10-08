export type Regime = "new" | "old";

export type EmployerCategory =
  | "CGOV"
  | "SGOV"
  | "PSU"
  | "PE"
  | "PESG"
  | "PEPS"
  | "PEO"
  | "OTH"
  | "NA";

export type PropertyType = "self_occupied" | "let_out" | "deemed_let_out";

export type BankAccountType = "SB" | "CA" | "CC" | "OD" | "NRO" | "OTH";

export interface AssessmentYearInfo {
  assessment_year: string;
  financial_year: string;
  due_date: string;
  belated_deadline: string;
}

export interface Address {
  flat_no: string | null;
  building: string | null;
  street: string | null;
  locality: string | null;
  city: string | null;
  state_code: string | null;
  pin_code: string | null;
}

export interface PersonalInfo {
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  father_name: string | null;
  pan: string | null;
  aadhaar: string | null;
  date_of_birth: string | null;
  mobile: string | null;
  email: string | null;
  employer_category: EmployerCategory | null;
  address: Address;
}

export interface Eligibility {
  is_resident: boolean | null;
  is_director: boolean;
  held_unlisted_shares: boolean;
  has_foreign_assets_or_income: boolean;
  has_capital_gains: boolean;
  has_business_income: boolean;
  agricultural_income_above_5000: boolean;
  has_brought_forward_losses: boolean;
  tax_deferred_on_esop: boolean;
}

export interface HraInputs {
  basic_salary: number;
  dearness_allowance: number;
  hra_received: number;
  rent_paid: number;
  is_metro: boolean;
}

export interface EmployerTds {
  name: string | null;
  tan: string | null;
  /** Employer address — required in ITR-2 / ITR-3. */
  address: string | null;
  city: string | null;
  state_code: string | null;
  pin_code: string | null;
  income_chargeable: number;
  tds: number;
}

export interface SalaryInfo {
  salary_17_1: number;
  perquisites_17_2: number;
  profits_17_3: number;
  hra: HraInputs;
  lta_exemption: number;
  gratuity_exemption: number;
  leave_encashment_exemption: number;
  professional_tax: number;
  employers: EmployerTds[];
}

export interface HomeLoan {
  lender_type: "B" | "I";
  lender_name: string | null;
  account_no: string | null;
  sanction_date: string | null;
  total_amount: number;
  outstanding_amount: number;
}

export interface HouseProperty {
  property_type: PropertyType;
  address: string | null;
  city: string | null;
  state_code: string | null;
  pin_code: string | null;
  gross_rent: number;
  municipal_tax_paid: number;
  interest_on_loan: number;
  loan: HomeLoan;
  tenant_name: string | null;
}

export interface Dividends {
  upto_15_jun: number;
  jun_16_to_sep_15: number;
  sep_16_to_dec_15: number;
  dec_16_to_mar_15: number;
  mar_16_to_mar_31: number;
}

export interface OtherIncome {
  savings_interest: number;
  deposit_interest: number;
  refund_interest: number;
  family_pension: number;
  dividends: Dividends;
  other_amount: number;
  other_description: string | null;
}

export interface Section80CItem {
  description: string | null;
  identification_no: string | null;
  amount: number;
}

export interface HealthPolicy {
  insurer: string | null;
  policy_no: string | null;
  premium: number;
}

export interface HealthInsurance {
  claiming: boolean;
  includes_senior_citizen: boolean;
  policies: HealthPolicy[];
  preventive_checkup: number;
  medical_expenditure: number;
}

export interface Deductions {
  section_80c: Section80CItem[];
  section_80ccd_1b: number;
  section_80ccd_2: number;
  pran: string | null;
  health_self: HealthInsurance;
  health_parents: HealthInsurance;
}

export interface TdsOther {
  deductor_name: string | null;
  tan: string | null;
  section: string;
  amount_paid: number;
  tds_deducted: number;
  tds_claimed: number;
  deducted_year: string;
}

export interface Challan {
  bsr_code: string | null;
  date_of_deposit: string | null;
  challan_serial_no: string | null;
  amount: number;
}

export interface TcsEntry {
  collector_name: string | null;
  tan: string | null;
  amount_collected: number;
  amount_claimed: number;
}

export interface TaxesPaid {
  tds_other: TdsOther[];
  tcs: TcsEntry[];
  challans: Challan[];
}

export interface BankAccount {
  ifsc: string | null;
  bank_name: string | null;
  account_no: string | null;
  account_type: BankAccountType;
  use_for_refund: boolean;
}

export type CapitalAssetType = "equity_share" | "equity_mf" | "debt_mf";

export interface CapitalGainTxn {
  asset_type: CapitalAssetType;
  term: "short" | "long";
  name: string | null;
  isin: string | null;
  quantity: number;
  sale_date: string | null;
  sale_value: number;
  cost: number;
  expenses: number;
  acquired_before_feb_2018: boolean;
  fmv_31_jan_2018: number;
}

export interface Trading {
  speculative_turnover: number;
  speculative_profit: number;
  fno_turnover: number;
  fno_profit: number;
  fno_expenses: number;
}

export interface ItrDraftData {
  regime: Regime;
  personal: PersonalInfo;
  eligibility: Eligibility;
  salary: SalaryInfo;
  house_properties: HouseProperty[];
  other_income: OtherIncome;
  deductions: Deductions;
  taxes_paid: TaxesPaid;
  capital_gains: CapitalGainTxn[];
  trading: Trading;
  bank_accounts: BankAccount[];
  verification_place: string | null;
}

export interface ItrFilingOut {
  assessment_year: string;
  status: "draft" | "exported";
  data: ItrDraftData;
  updated_at: string;
  last_exported_at: string | null;
  /** Draft path -> document it was auto-filled from, e.g. "Form 16". */
  field_sources: Record<string, string>;
}

export interface RegimeComputation {
  regime: Regime;
  gross_salary: number;
  exempt_allowances: number;
  net_salary: number;
  standard_deduction: number;
  professional_tax: number;
  income_from_salary: number;
  income_from_house_property: number;
  income_from_other_sources: number;
  family_pension_deduction: number;
  stcg_111a: number;
  stcg_slab: number;
  ltcg_112a: number;
  income_from_capital_gains: number;
  speculative_income: number;
  business_income: number;
  income_from_business: number;
  losses_carried_forward: Record<string, number>;
  gross_total_income: number;
  chapter_via_deductions: number;
  deduction_breakup: Record<string, number>;
  total_income: number;
  tax_on_total_income: number;
  tax_at_normal_rates: number;
  tax_at_special_rates: number;
  rebate_87a: number;
  tax_after_rebate: number;
  surcharge: number;
  cess: number;
  gross_tax_liability: number;
  interest_234a: number;
  interest_234b: number;
  interest_234c: number;
  fee_234f: number;
  total_tax_and_interest: number;
  tds: number;
  tcs: number;
  advance_tax: number;
  self_assessment_tax: number;
  total_taxes_paid: number;
  refund_due: number;
  balance_payable: number;
}

export interface Issue {
  field: string | null;
  message: string;
}

export interface ItrSummary {
  assessment_year: string;
  filing_date: string;
  filing_section: "139(1)" | "139(4)";
  is_belated: boolean;
  old_regime_allowed: boolean;
  selected: RegimeComputation;
  alternative: RegimeComputation | null;
  eligibility_issues: Issue[];
  missing_fields: Issue[];
  warnings: string[];
  can_export: boolean;
  recommended_form: FormRecommendation | null;
}

export interface ItrExport {
  file_name: string;
  form: ItrForm;
  itr: object;
}

export type ItrForm = "ITR-1" | "ITR-2" | "ITR-3";

export interface FormReason {
  form: ItrForm;
  reason: string;
  source: string;
}

export interface DocumentCheck {
  category: string;
  title: string;
  why: string;
  required: boolean;
  uploaded: boolean;
}

export interface FormRecommendation {
  form: ItrForm;
  supported: boolean;
  blockers: string[];
  reasons: FormReason[];
  other_reasons: FormReason[];
  checklist: DocumentCheck[];
}

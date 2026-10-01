import type {
  BankAccount,
  Challan,
  EmployerCategory,
  EmployerTds,
  HealthPolicy,
  HouseProperty,
  Section80CItem,
  TcsEntry,
  TdsOther,
} from "@/lib/itr/types";

export const STEPS = [
  { id: 1, label: "Personal info" },
  { id: 2, label: "Income" },
  { id: 3, label: "Deductions" },
  { id: 4, label: "Taxes paid" },
  { id: 5, label: "Regime & bank" },
  { id: 6, label: "Review & download" },
] as const;

export const LAST_STEP = STEPS.length;

const FIELD_STEPS: Record<string, number> = {
  personal: 1,
  eligibility: 1,
  salary: 2,
  house_properties: 2,
  other_income: 2,
  deductions: 3,
  taxes_paid: 4,
  regime: 5,
  bank_accounts: 5,
  verification_place: 5,
};

export function stepForField(field: string | null): number | null {
  const prefix = field?.match(/^[a-z0-9_]+/)?.[0];
  return prefix ? (FIELD_STEPS[prefix] ?? null) : null;
}

export const EMPLOYER_CATEGORIES: { value: EmployerCategory; label: string }[] = [
  { value: "CGOV", label: "Central Government" },
  { value: "SGOV", label: "State Government" },
  { value: "PSU", label: "Public Sector Undertaking" },
  { value: "PE", label: "Pensioners – Central Govt" },
  { value: "PESG", label: "Pensioners – State Govt" },
  { value: "PEPS", label: "Pensioners – PSU" },
  { value: "PEO", label: "Pensioners – Others" },
  { value: "OTH", label: "Others (private)" },
  { value: "NA", label: "Not applicable" },
];

export const STATES: { code: string; name: string }[] = [
  { code: "01", name: "Andaman and Nicobar Islands" },
  { code: "02", name: "Andhra Pradesh" },
  { code: "03", name: "Arunachal Pradesh" },
  { code: "04", name: "Assam" },
  { code: "05", name: "Bihar" },
  { code: "06", name: "Chandigarh" },
  { code: "07", name: "Dadra Nagar and Haveli" },
  { code: "08", name: "Daman and Diu" },
  { code: "09", name: "Delhi" },
  { code: "10", name: "Goa" },
  { code: "11", name: "Gujarat" },
  { code: "12", name: "Haryana" },
  { code: "13", name: "Himachal Pradesh" },
  { code: "14", name: "Jammu and Kashmir" },
  { code: "15", name: "Karnataka" },
  { code: "16", name: "Kerala" },
  { code: "17", name: "Lakshadweep" },
  { code: "18", name: "Madhya Pradesh" },
  { code: "19", name: "Maharashtra" },
  { code: "20", name: "Manipur" },
  { code: "21", name: "Meghalaya" },
  { code: "22", name: "Mizoram" },
  { code: "23", name: "Nagaland" },
  { code: "24", name: "Odisha" },
  { code: "25", name: "Puducherry" },
  { code: "26", name: "Punjab" },
  { code: "27", name: "Rajasthan" },
  { code: "28", name: "Sikkim" },
  { code: "29", name: "Tamil Nadu" },
  { code: "30", name: "Tripura" },
  { code: "31", name: "Uttar Pradesh" },
  { code: "32", name: "West Bengal" },
  { code: "33", name: "Chhattisgarh" },
  { code: "34", name: "Uttarakhand" },
  { code: "35", name: "Jharkhand" },
  { code: "36", name: "Telangana" },
  { code: "37", name: "Ladakh" },
];

export const TDS_SECTIONS = [
  { value: "94A", label: "194A – Interest other than securities" },
  { value: "193", label: "193 – Interest on securities" },
  { value: "194", label: "194 – Dividends" },
  { value: "4-IB", label: "194I(b) – Rent" },
  { value: "94J-B", label: "194J(b) – Professional fees" },
  { value: "192A", label: "192A – PF withdrawal" },
];

export const BANK_ACCOUNT_TYPES = [
  { value: "SB", label: "Savings" },
  { value: "CA", label: "Current" },
  { value: "CC", label: "Cash credit" },
  { value: "OD", label: "Overdraft" },
  { value: "NRO", label: "NRO" },
  { value: "OTH", label: "Other" },
] as const;

export const emptyEmployer = (): EmployerTds => ({
  name: null,
  tan: null,
  income_chargeable: 0,
  tds: 0,
});

export const emptyHouseProperty = (): HouseProperty => ({
  property_type: "self_occupied",
  address: null,
  city: null,
  state_code: null,
  pin_code: null,
  gross_rent: 0,
  municipal_tax_paid: 0,
  interest_on_loan: 0,
  loan: {
    lender_type: "B",
    lender_name: null,
    account_no: null,
    sanction_date: null,
    total_amount: 0,
    outstanding_amount: 0,
  },
  tenant_name: null,
});

export const empty80CItem = (): Section80CItem => ({
  description: null,
  identification_no: null,
  amount: 0,
});

export const emptyHealthPolicy = (): HealthPolicy => ({
  insurer: null,
  policy_no: null,
  premium: 0,
});

export const emptyTdsOther = (): TdsOther => ({
  deductor_name: null,
  tan: null,
  section: "94A",
  amount_paid: 0,
  tds_deducted: 0,
  tds_claimed: 0,
  deducted_year: "2025",
});

export const emptyTcs = (): TcsEntry => ({
  collector_name: null,
  tan: null,
  amount_collected: 0,
  amount_claimed: 0,
});

export const emptyChallan = (): Challan => ({
  bsr_code: null,
  date_of_deposit: null,
  challan_serial_no: null,
  amount: 0,
});

export const emptyBankAccount = (): BankAccount => ({
  ifsc: null,
  bank_name: null,
  account_no: null,
  account_type: "SB",
  use_for_refund: false,
});

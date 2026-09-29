/**
 * MOCK DATA — for UI prototyping only. No real portfolio integration exists.
 */
export interface MockInvestment {
  id: string;
  name: string;
  type: string;
  invested: number;
  current: number;
}

export const mockInvestments: MockInvestment[] = [
  { id: "i1", name: "Axis Bluechip Fund", type: "Equity — ELSS", invested: 90000, current: 104200 },
  { id: "i2", name: "PPF", type: "Fixed Income", invested: 150000, current: 162500 },
  { id: "i3", name: "NPS Tier 1", type: "Retirement", invested: 60000, current: 64800 },
  { id: "i4", name: "Company Stock (ESPP)", type: "Equity", invested: 40000, current: 37200 },
];

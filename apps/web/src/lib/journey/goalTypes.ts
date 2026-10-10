export type GoalTypeId =
  | "efund"
  | "car"
  | "house"
  | "travel"
  | "study"
  | "marriage"
  | "family"
  | "business"
  | "retire"
  | "wealth"
  | "debt";

export interface GoalTypeDef {
  t: GoalTypeId;
  label: string;
  title: string;
  /** [min, max] rupees — drives the amount slider's log-scale range. */
  range: [number, number];
  def: number;
  /** Multi-decade goals (retirement, wealth) get different framing in projections. */
  long?: boolean;
  /** Preset sub-kinds, each [label, typicalAmount|null]. Only types that need a "what kind" question have this. */
  kinds?: [string, number | null][];
  /** Guided question text per wizard step, where this type needs custom phrasing. */
  q?: { kind?: string; when?: string; amount?: string };
}

export const GOAL_TYPES: GoalTypeDef[] = [
  { t: "efund", label: "Build emergency fund", title: "Emergency fund", range: [50000, 2000000], def: 300000 },
  {
    t: "car",
    label: "Buy a car",
    title: "Buy a car",
    range: [200000, 4000000],
    def: 800000,
    kinds: [["Hatchback", 700000], ["Sedan", 1200000], ["SUV", 1600000], ["Electric", 1500000], ["Not sure yet", null]],
    q: {
      kind: "What kind of car are you thinking about?",
      when: "When are you thinking of buying it?",
      amount: "Roughly how much are you comfortable spending?",
    },
  },
  {
    t: "house",
    label: "Buy a house",
    title: "Buy a home",
    range: [1000000, 50000000],
    def: 7500000,
    kinds: [["1 BHK", 4500000], ["2 BHK", 8000000], ["3 BHK", 13000000], ["Plot or villa", 20000000], ["Not sure yet", null]],
    q: {
      kind: "What kind of home are you picturing?",
      when: "When would you like to buy?",
      amount: "Roughly what would the home cost?",
    },
  },
  {
    t: "travel",
    label: "Travel",
    title: "Travel",
    range: [20000, 1500000],
    def: 250000,
    kinds: [["Within India", 80000], ["Southeast Asia", 150000], ["Europe", 350000], ["Long-haul", 500000]],
    q: { kind: "Where are you thinking of going?", when: "When would you like to go?" },
  },
  {
    t: "study",
    label: "Higher studies",
    title: "Higher studies",
    range: [100000, 10000000],
    def: 2500000,
    kinds: [["In India", 1200000], ["Abroad", 4000000], ["Online or part-time", 300000]],
    q: { kind: "Where would you study?", when: "When would you start?" },
  },
  { t: "marriage", label: "Marriage", title: "Marriage", range: [200000, 10000000], def: 1500000 },
  { t: "family", label: "Start a family", title: "Start a family", range: [100000, 5000000], def: 600000 },
  { t: "business", label: "Start a business", title: "Start a business", range: [100000, 20000000], def: 1500000 },
  { t: "retire", label: "Retirement", title: "Retirement", range: [5000000, 200000000], def: 30000000, long: true },
  { t: "wealth", label: "Build wealth", title: "Build wealth", range: [500000, 100000000], def: 5000000, long: true },
  { t: "debt", label: "Pay off debt", title: "Pay off debt", range: [20000, 10000000], def: 300000 },
];

export const GT: Record<GoalTypeId, GoalTypeDef> = GOAL_TYPES.reduce(
  (acc, g) => ({ ...acc, [g.t]: g }),
  {} as Record<GoalTypeId, GoalTypeDef>,
);

/** Fallback shape for a custom (user-typed, not a preset) goal. */
export const CUSTOM_T = { t: "custom" as const, title: "Goal", range: [10000, 50000000] as [number, number], def: 500000 };

/** Goal types that can be partly financed by a loan. */
export const LOAN_OK: Partial<Record<GoalTypeId | "custom", true>> = {
  car: true,
  house: true,
  study: true,
  business: true,
  custom: true,
  marriage: true,
};

/** Goal types where "funded by a loan" doesn't make sense — skipped in the wizard. */
export const NO_FUND: Partial<Record<GoalTypeId, true>> = { efund: true, retire: true, wealth: true, debt: true };

export const EVENT_TYPES = [
  "New job",
  "Salary increase",
  "Job switch",
  "Moving cities",
  "Marriage",
  "Starting a family",
  "Starting a business",
  "Major travel",
  "Retirement",
];

export const STAGES = ["Studying", "Early career", "Mid career", "Self-employed", "Between jobs", "Retired", "Rather not say"];

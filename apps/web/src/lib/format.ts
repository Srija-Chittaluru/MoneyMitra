const inrFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatINR(amount: number): string {
  return inrFormatter.format(amount);
}

export function formatSignedINR(amount: number): string {
  const formatted = formatINR(Math.abs(amount));
  return amount < 0 ? `-${formatted}` : `+${formatted}`;
}

const rupeeFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

/** Whole rupees, e.g. "₹24,26,430" — for amounts that never have paise (ITR figures). */
export function formatRupees(amount: number): string {
  return rupeeFormatter.format(amount);
}

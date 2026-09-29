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

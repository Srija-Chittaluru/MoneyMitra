import { useMemo } from "react";

/** Real, live countdown to the next 31 March — the actual deadline for FY tax-saving investments in India. */
export function useTaxDeadline() {
  return useMemo(() => {
    const now = new Date();
    const deadline = new Date(now.getFullYear(), 2, 31);
    if (deadline.getTime() < now.getTime()) {
      deadline.setFullYear(deadline.getFullYear() + 1);
    }
    const days = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const fyStart = deadline.getFullYear() - 1;
    const fyLabel = `FY ${fyStart}-${String(deadline.getFullYear()).slice(2)}`;
    return { days, fyLabel };
  }, []);
}

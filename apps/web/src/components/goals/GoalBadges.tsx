import { Badge } from "@/components/ui/Badge";
import type { AffordabilityStatus, GoalStatus, Risk } from "@/lib/goals/types";

type Variant = "success" | "warning" | "error" | "neutral" | "accent";

const AFFORDABILITY: Record<AffordabilityStatus, { variant: Variant; label: string }> = {
  affordable: { variant: "success", label: "Fits your budget" },
  tight: { variant: "warning", label: "Tight fit" },
  unaffordable: { variant: "error", label: "Over budget" },
  // Never a verdict: we don't have the figures to say either way.
  unknown: { variant: "neutral", label: "Can't check yet" },
};

const STATUS: Record<Exclude<GoalStatus, "active">, { variant: Variant; label: string }> = {
  completed: { variant: "success", label: "Completed" },
  archived: { variant: "neutral", label: "Archived" },
};

const RISK: Record<Risk, { variant: Variant; label: string }> = {
  low: { variant: "success", label: "Low risk" },
  medium: { variant: "warning", label: "Medium risk" },
  high: { variant: "error", label: "Higher risk" },
};

export function AffordabilityBadge({ status }: { status: AffordabilityStatus }) {
  const { variant, label } = AFFORDABILITY[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function GoalStatusBadge({ status }: { status: GoalStatus }) {
  if (status === "active") return null;
  const { variant, label } = STATUS[status];
  return <Badge variant={variant}>{label}</Badge>;
}

export function RiskBadge({ risk }: { risk: Risk }) {
  const { variant, label } = RISK[risk];
  return <Badge variant={variant}>{label}</Badge>;
}

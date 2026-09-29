import { Card } from "./Card";
import { formatINR } from "@/lib/format";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  amount: number;
  helpText?: ReactNode;
}

export function StatTile({ label, amount, helpText }: StatTileProps) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-mono text-amount-lg text-foreground">{formatINR(amount)}</p>
      {helpText && <p className="mt-1 text-sm text-muted">{helpText}</p>}
    </Card>
  );
}

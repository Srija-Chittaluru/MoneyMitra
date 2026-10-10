import { Card } from "./Card";
import { formatINR } from "@/lib/format";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface StatTileProps {
  label: string;
  amount: number;
  helpText?: ReactNode;
  icon?: LucideIcon;
  className?: string;
}

export function StatTile({ label, amount, helpText, icon: Icon, className }: StatTileProps) {
  return (
    <Card className={className}>
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10">
            <Icon className="h-3.5 w-3.5 text-accent-text" strokeWidth={2} />
          </span>
        )}
        <p className="text-sm text-muted">{label}</p>
      </div>
      <p className="mt-2 break-words text-amount-lg text-foreground">{formatINR(amount)}</p>
      {helpText && <p className="mt-1 text-sm text-muted">{helpText}</p>}
    </Card>
  );
}

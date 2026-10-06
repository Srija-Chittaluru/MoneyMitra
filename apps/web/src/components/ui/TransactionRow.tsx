import { Avatar } from "./Avatar";
import { formatSignedINR } from "@/lib/format";
import { cn } from "@/lib/cn";

interface TransactionRowProps {
  initial: string;
  title: string;
  subtitle: string;
  amount: number;
  /** Money in is shown in success green; money out stays neutral, per brand rule ("outflows stay neutral"). */
  isCredit?: boolean;
}

export function TransactionRow({
  initial,
  title,
  subtitle,
  amount,
  isCredit = amount > 0,
}: TransactionRowProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar initial={initial} />
      <div className="flex-1 min-w-0">
        <p className="truncate font-medium text-foreground">{title}</p>
        <p className="truncate text-sm text-muted">{subtitle}</p>
      </div>
      <p
        className={cn(
          "text-amount-sm",
          isCredit ? "text-success" : "text-foreground",
        )}
      >
        {formatSignedINR(amount)}
      </p>
    </div>
  );
}

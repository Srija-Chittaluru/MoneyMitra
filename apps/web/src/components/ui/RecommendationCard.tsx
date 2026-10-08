import Link from "next/link";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";

interface RecommendationCardProps {
  title: string;
  description: string;
  reason: string;
  tag: string;
  /** Optional line saying what the advice is based on. */
  basis?: string;
  /** Omitted for advice with no single next action. */
  actionLabel?: string | null;
  /** When set, the action button links to this in-app route. */
  actionHref?: string | null;
}

export function RecommendationCard({
  title,
  description,
  reason,
  tag,
  basis,
  actionLabel,
  actionHref,
}: RecommendationCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-h2">{title}</h3>
        <Badge variant="neutral">{tag}</Badge>
      </div>
      {basis && <p className="-mt-1 text-xs text-muted">{basis}</p>}
      <p className="text-body text-foreground">{description}</p>
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">Why: </span>
        {reason}
      </p>
      {actionLabel && (
        <div>
          {actionHref ? (
            <Link href={actionHref}>
              <Button variant="secondary" size="sm">
                {actionLabel}
              </Button>
            </Link>
          ) : (
            <Button variant="secondary" size="sm">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

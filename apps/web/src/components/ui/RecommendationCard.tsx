import Link from "next/link";
import { Card } from "./Card";
import { Badge } from "./Badge";
import { Button } from "./Button";

interface RecommendationCardProps {
  title: string;
  description: string;
  reason: string;
  tag: string;
  actionLabel: string;
  /** When set, the action button links to this in-app route. */
  actionHref?: string;
}

export function RecommendationCard({
  title,
  description,
  reason,
  tag,
  actionLabel,
  actionHref,
}: RecommendationCardProps) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-h2">{title}</h3>
        <Badge variant="neutral">{tag}</Badge>
      </div>
      <p className="text-body text-foreground">{description}</p>
      <p className="text-sm text-muted">
        <span className="font-medium text-foreground">Why: </span>
        {reason}
      </p>
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
    </Card>
  );
}

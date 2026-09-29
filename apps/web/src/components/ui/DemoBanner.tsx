import { Badge } from "./Badge";

interface DemoBannerProps {
  label?: string;
}

/** Standard "this is mock data" marker, reused across every prototype page. */
export function DemoBanner({ label = "Demo data — not connected to a real account" }: DemoBannerProps) {
  return (
    <div className="mb-6">
      <Badge variant="warning">{label}</Badge>
    </div>
  );
}

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
}

export function NavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      className={cn(
        "relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors",
        active
          ? "bg-surface-muted text-foreground font-semibold"
          : "text-muted hover:bg-surface-muted hover:text-foreground",
      )}
    >
      {active && (
        <span className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-full bg-accent" />
      )}
      <Icon className="h-5 w-5 shrink-0" strokeWidth={1.75} />
      {label}
    </Link>
  );
}

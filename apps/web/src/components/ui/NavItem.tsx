import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

interface NavItemProps {
  href: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  /** Always show the label, bypassing group-hover — for the mobile drawer, which has no hover. */
  forceExpanded?: boolean;
}

// Pill-shaped rail item: icon always visible, label only takes space once the
// rail expands (driven by the parent's `group` hover — see Sidebar.tsx). The
// label is always in the DOM (not conditionally rendered) so it's available
// to assistive tech and search-in-page regardless of the rail's width.
export function NavItem({ href, label, icon: Icon, active, forceExpanded = false }: NavItemProps) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "flex h-12 shrink-0 items-center gap-3.5 overflow-hidden rounded-full px-3 text-sm transition-colors",
        active ? "bg-rail-active text-foreground font-semibold" : "text-rail-fg hover:bg-hover hover:text-foreground",
      )}
    >
      <Icon className="h-6 w-6 shrink-0" strokeWidth={1.75} />
      <span className={cn("whitespace-nowrap", forceExpanded ? "inline" : "hidden group-hover:inline")}>
        {label}
      </span>
    </Link>
  );
}

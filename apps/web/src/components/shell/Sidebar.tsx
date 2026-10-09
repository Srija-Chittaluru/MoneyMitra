"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NavItem } from "@/components/ui/NavItem";
import { cn } from "@/lib/cn";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./nav-items";

// Collapsed by default (icon-only, 78px) and expands to 224px on hover,
// revealing labels — matches the rail width/behavior from the design mockup.
// A plain CSS width transition driven by `group`/`group-hover`, rather than
// JS-tracked hover state, so there's no flicker and it degrades gracefully.
// `forceExpanded` is for the mobile drawer, where there's no hover at all —
// it needs to render at full width with labels always visible.
export function Sidebar({ forceExpanded = false }: { forceExpanded?: boolean }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        "group flex h-full shrink-0 flex-col gap-2 overflow-hidden border-r border-line bg-frame px-[15px] py-4 transition-[width] duration-300 ease-out",
        forceExpanded ? "w-56" : "w-[78px] hover:w-56",
      )}
    >
      <div className="mb-4 flex h-9 items-center pl-[1px]">
        <Logo markOnly height={24} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1 border-t border-line pt-3">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
            forceExpanded={forceExpanded}
          />
        ))}
      </div>
    </nav>
  );
}

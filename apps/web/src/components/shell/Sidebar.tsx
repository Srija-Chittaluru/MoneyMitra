"use client";

import { usePathname } from "next/navigation";
import { Logo } from "@/components/Logo";
import { NavItem } from "@/components/ui/NavItem";
import { NAV_ITEMS, SECONDARY_NAV_ITEMS } from "./nav-items";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="flex h-full w-64 shrink-0 flex-col gap-6 border-r border-border bg-surface p-4">
      <div className="px-2 pt-2">
        <Logo height={32} />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </div>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        {SECONDARY_NAV_ITEMS.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
          />
        ))}
      </div>
    </nav>
  );
}

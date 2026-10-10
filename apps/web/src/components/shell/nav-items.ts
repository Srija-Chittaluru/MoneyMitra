import {
  CalendarRange,
  FileCheck2,
  FileStack,
  Landmark,
  LayoutDashboard,
  Megaphone,
  Scale,
  Settings,
  Sparkles,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/tax-comparison", label: "Tax Comparison", icon: Scale },
  { href: "/tax-planning", label: "Tax Planning", icon: CalendarRange },
  { href: "/itr-filing", label: "ITR Filing", icon: FileCheck2 },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/fd-comparison", label: "FD Comparison", icon: Landmark },
  { href: "/resources", label: "Resources & Alerts", icon: Megaphone },
] as const;

export const SECONDARY_NAV_ITEMS = [
  { href: "/profile", label: "Profile / Settings", icon: Settings },
] as const;

import {
  CalendarRange,
  FileCheck2,
  FileStack,
  Footprints,
  LayoutDashboard,
  Megaphone,
  Scale,
  Settings,
  Sparkles,
  Target,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/journey", label: "My Journey", icon: Footprints },
  { href: "/documents", label: "Documents", icon: FileStack },
  { href: "/tax-comparison", label: "Tax Comparison", icon: Scale },
  { href: "/tax-planning", label: "Tax Planning", icon: CalendarRange },
  { href: "/itr-filing", label: "ITR Filing", icon: FileCheck2 },
  { href: "/recommendations", label: "Recommendations", icon: Sparkles },
  { href: "/goals", label: "Goals", icon: Target },
  { href: "/resources", label: "Resources & Alerts", icon: Megaphone },
] as const;

export const SECONDARY_NAV_ITEMS = [
  { href: "/profile", label: "Profile / Settings", icon: Settings },
] as const;

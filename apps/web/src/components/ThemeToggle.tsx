"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useHasMounted } from "@/lib/use-has-mounted";
import { Switch } from "./ui/Switch";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const mounted = useHasMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex items-center gap-2">
      <Sun className="h-4 w-4 text-muted" />
      <Switch
        checked={isDark}
        onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")}
        label="Toggle dark mode"
      />
      <Moon className="h-4 w-4 text-muted" />
    </div>
  );
}

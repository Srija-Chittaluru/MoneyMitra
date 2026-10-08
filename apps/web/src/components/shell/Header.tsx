"use client";

import { LogOut, Menu } from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/Avatar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth/AuthContext";

interface HeaderProps {
  onMenuClick: () => void;
  title: string;
}

export function Header({ onMenuClick, title }: HeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-frame px-4 md:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          className="rounded-md p-2 text-muted hover:bg-hover hover:text-foreground md:hidden"
          aria-label="Open navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <h1 className="text-h2">{title}</h1>
      </div>
      <div className="flex items-center gap-4">
        <ThemeToggle />
        <Avatar initial={user?.name.charAt(0).toUpperCase() ?? "?"} />
        <button
          type="button"
          onClick={() => {
            logout().finally(() => router.push("/"));
          }}
          className="rounded-md p-2 text-muted hover:bg-hover hover:text-foreground"
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
}

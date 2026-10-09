"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LinkButton } from "./parts";

const NAV_LINKS = [
  { label: "How it works", href: "#how" },
  { label: "Tax", href: "#tax" },
  { label: "Your picture", href: "#picture" },
  { label: "All year", href: "#year" },
];

export function LandingNav() {
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-6 px-4 md:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="MoneyMitra home">
          <Logo height={32} />
        </Link>

        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map(({ label, href }) => (
            <a
              key={href}
              href={href}
              data-nav-link
              className="rounded-md px-3 py-2 text-sm font-medium text-muted transition-colors hover:text-foreground"
            >
              {label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden items-center gap-3 lg:flex">
            <ThemeToggle />
            <LinkButton href="/login" variant="ghost" size="sm">
              Log in
            </LinkButton>
          </div>
          <LinkButton href="/signup" size="sm">
            Get started
          </LinkButton>
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="landing-mobile-menu"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-foreground transition-colors hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring lg:hidden"
          >
            {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {open && (
        <div
          id="landing-mobile-menu"
          className="border-t border-line bg-background px-4 pb-4 pt-2 lg:hidden"
        >
          <nav aria-label="Mobile" className="flex flex-col">
            {NAV_LINKS.map(({ label, href }) => (
              <a
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="border-b border-line py-3 text-base font-medium text-foreground"
              >
                {label}
              </a>
            ))}
            <Link
              href="/login"
              className="border-b border-line py-3 text-base font-medium text-foreground"
            >
              Log in
            </Link>
          </nav>
          <div className="pt-4">
            <ThemeToggle />
          </div>
        </div>
      )}
    </header>
  );
}

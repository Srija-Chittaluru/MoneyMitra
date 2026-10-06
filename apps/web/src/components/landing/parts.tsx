import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TAX, inr } from "./demo-data";

/* ---------- Layout primitives ---------- */

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 md:px-8", className)}>
      {children}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <p className="text-caption uppercase tracking-[0.08em] text-link">
      {children}
    </p>
  );
}

/* ---------- Links styled as buttons (avoids <a><button> nesting) ---------- */

interface LinkButtonProps {
  href: string;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
  className?: string;
  children: ReactNode;
}

const linkButtonVariants = {
  primary: "bg-primary text-primary-foreground hover:opacity-90",
  secondary:
    "border border-border bg-transparent text-foreground hover:bg-surface-muted",
  ghost: "bg-transparent text-muted hover:text-foreground",
};

const linkButtonSizes = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-5 text-base",
};

export function LinkButton({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring",
        linkButtonVariants[variant],
        linkButtonSizes[size],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/* ---------- Product-UI primitives shared by the mockups ---------- */

const WINDOW_SHADOW =
  "shadow-[0_1px_2px_rgba(11,15,20,0.05),0_28px_56px_-24px_rgba(11,15,20,0.28)]";

export function WindowFrame({
  title,
  children,
  className,
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-border bg-surface",
        WINDOW_SHADOW,
        className,
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-surface-muted px-4 py-2.5">
        <span aria-hidden className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2.5 w-2.5 rounded-full bg-border" />
          ))}
        </span>
        <span className="text-[11px] font-medium text-muted">{title}</span>
        <span className="ml-auto rounded-full border border-border bg-surface px-2 py-0.5 text-[10px] font-medium text-muted">
          Demo data
        </span>
      </div>
      {children}
    </div>
  );
}

type PillTone = "success" | "warning" | "error" | "neutral" | "accent";

const pillTones: Record<PillTone, string> = {
  success: "bg-success-bg text-success",
  warning: "bg-warning-bg text-warning",
  error: "bg-error-bg text-error",
  neutral: "bg-surface-muted text-muted",
  accent: "bg-accent text-accent-foreground",
};

export function Pill({
  tone = "neutral",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium leading-4",
        pillTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Amount({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cn("font-medium tabular-nums", className)}>
      {children}
    </span>
  );
}

/** Old vs. new regime, as two proportional bars. Shared by the hero mockup and feature card. */
export function RegimeBars({ className }: { className?: string }) {
  const newWidth = Math.round(
    (TAX.newRegime.total / TAX.oldRegime.total) * 100,
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="text-muted">Old regime</span>
          <Amount className="text-foreground">
            {inr(TAX.oldRegime.total)}
          </Amount>
        </div>
        <div className="h-2.5 rounded-full bg-surface-muted">
          <div className="h-full w-full rounded-full bg-foreground/20" />
        </div>
      </div>
      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs">
          <span className="flex items-center gap-2 text-foreground">
            New regime
            <Pill tone="accent">Recommended</Pill>
          </span>
          <Amount className="text-foreground">
            {inr(TAX.newRegime.total)}
          </Amount>
        </div>
        <div className="h-2.5 rounded-full bg-surface-muted">
          <div
            className="h-full rounded-full bg-link"
            style={{ width: `${newWidth}%` }}
          />
        </div>
      </div>
    </div>
  );
}

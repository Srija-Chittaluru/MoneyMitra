import { CheckCircle2, FileText, MousePointer2 } from "lucide-react";
import { Pill } from "@/components/landing/parts";
import { cn } from "@/lib/cn";

/** An upward trend line + arrowhead, in the accent color. Decorative only. */
export function TrendArrowIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 400 300" fill="none" aria-hidden className={className}>
      <polyline
        points="20,220 70,180 120,230 170,150 220,190 280,100 330,140 380,50"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <polygon points="397,15 390,64 358,44" fill="currentColor" />
    </svg>
  );
}

/**
 * Flat, on-brand "product" illustrations — no external assets, just shapes
 * and lucide icons in the theme palette. Shared between the auth screens
 * (AuthBrandPanel) and the dashboard hero, so the same visual language
 * carries through from login into the app.
 */
export function DashboardIllustration({ className, badgeLabel = "Auto-matched" }: { className?: string; badgeLabel?: string }) {
  return (
    <div className={cn("relative h-[168px] w-[220px] shrink-0", className)}>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent/40"
      />

      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center">
        <div className="flex h-24 w-36 items-end justify-center gap-2 rounded-2xl bg-primary p-3 shadow-lg">
          <span className="h-[55%] w-3 rounded-sm bg-white/30" />
          <span className="h-[85%] w-3 rounded-sm bg-accent" />
          <span className="h-[70%] w-3 rounded-sm bg-white/55" />
          <span className="h-full w-3 rounded-sm bg-white/30" />
        </div>
        <span className="mt-0.5 h-3 w-3 rounded-sm bg-primary" />
        <span className="mt-0.5 h-1.5 w-14 rounded-full bg-primary/70" />
      </div>

      <div className="absolute right-1 top-4 flex w-16 rotate-6 flex-col gap-1 rounded-lg border border-line bg-card p-2 shadow-md">
        <FileText className="h-3 w-3 text-muted" strokeWidth={1.75} />
        <span className="h-1 w-full rounded-full bg-border" />
        <span className="h-1 w-3/4 rounded-full bg-border" />
      </div>
      <MousePointer2
        className="absolute right-3 top-[66px] h-4 w-4 -rotate-6 text-primary"
        strokeWidth={2}
        fill="var(--surface)"
      />

      <div className="absolute bottom-0 left-0">
        <Pill tone="accent" className="gap-1 py-1">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          {badgeLabel}
        </Pill>
      </div>
    </div>
  );
}

/** Same chrome as DashboardIllustration (ring, stand, floating card, cursor, badge) with a growth-themed centerpiece. */
export function TrendIllustration({ className }: { className?: string }) {
  return (
    <div className={cn("relative h-[168px] w-[220px] shrink-0", className)}>
      <div
        aria-hidden
        className="absolute left-1/2 top-1/2 h-44 w-44 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent/40"
      />

      <div className="absolute left-1/2 top-5 flex -translate-x-1/2 flex-col items-center">
        <div className="flex h-24 w-36 items-center justify-center rounded-2xl bg-primary p-4 shadow-lg">
          <TrendArrowIcon className="h-12 w-full text-accent" />
        </div>
        <span className="mt-0.5 h-3 w-3 rounded-sm bg-primary" />
        <span className="mt-0.5 h-1.5 w-14 rounded-full bg-primary/70" />
      </div>

      <div className="absolute right-0 top-4 flex w-28 rotate-6 flex-col gap-0.5 whitespace-nowrap rounded-lg border border-line bg-card p-2.5 shadow-md">
        <p className="text-[9px] text-muted">Potential savings</p>
        <p className="text-sm font-semibold text-accent-text">₹18,400</p>
      </div>
      <MousePointer2
        className="absolute right-1 top-[72px] h-4 w-4 -rotate-6 text-primary"
        strokeWidth={2}
        fill="var(--surface)"
      />

      <div className="absolute bottom-0 left-0">
        <Pill tone="accent" className="gap-1 py-1">
          <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
          Free to get started
        </Pill>
      </div>
    </div>
  );
}

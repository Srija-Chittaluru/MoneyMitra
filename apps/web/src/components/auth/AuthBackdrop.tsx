import { cn } from "@/lib/cn";

/**
 * Decorative background for the login/signup pages. Light mode only — dark
 * mode keeps the plain near-black page it's always had, since there's no
 * dark-mode design this needs to match.
 */
export function AuthBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden dark:hidden", className)}>
      <div
        className="absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "28px 28px",
          maskImage: "radial-gradient(ellipse 65% 60% at 50% 35%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 65% 60% at 50% 35%, black, transparent 75%)",
        }}
      />
      <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />
      <div className="absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-link/15 blur-3xl" />
    </div>
  );
}

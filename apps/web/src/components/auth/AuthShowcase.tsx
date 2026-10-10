import { Amount, PhotoBackground } from "@/components/landing/parts";
import { TAX, inr } from "@/components/landing/demo-data";
import { cn } from "@/lib/cn";

/** Dark-mode-only right-side visual on the auth screens: the mockup's night-sky photo + floating glass cards. */
export function AuthShowcase({ className }: { className?: string }) {
  return (
    <div className={cn("relative isolate overflow-hidden rounded-3xl border border-line bg-field", className)}>
      <PhotoBackground src="/landing/pixel-sky.png" objectPosition="50% 70%" sizes="50vw" className="-z-10" />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-background/10 via-transparent to-background/55"
      />
      <div className="absolute inset-x-10 bottom-10 flex flex-col gap-3">
        <div
          data-float="a"
          className="rounded-xl border border-accent/40 bg-card/90 p-5 shadow-[0_0_50px_-12px_var(--color-accent)] backdrop-blur"
        >
          <p className="text-xs text-muted">Your next move</p>
          <p className="mt-1.5 text-lg font-medium leading-snug text-foreground">
            You could potentially save {inr(TAX.potentialSavings)} in taxes this year.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <div className="rounded-xl border border-line bg-card/80 px-4 py-3 backdrop-blur">
            <p className="text-xs text-muted">Annual income</p>
            <Amount className="mt-1 block text-lg text-foreground">{inr(TAX.gross)}</Amount>
          </div>
          <div className="rounded-xl border border-line bg-card/80 px-4 py-3 backdrop-blur">
            <p className="text-xs text-muted">Old vs new regime</p>
            <Amount className="mt-1 block text-lg text-accent-text">−{inr(TAX.regimeDifference)}</Amount>
          </div>
        </div>
      </div>
    </div>
  );
}

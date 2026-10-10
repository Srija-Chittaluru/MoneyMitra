import type { ReactNode } from "react";

/**
 * The form-side header on the light-mode login/signup screens: a small
 * decorative grid behind an icon badge, then the headline and subtext.
 * Purely cosmetic (no dark-mode equivalent — dark mode keeps its own
 * simpler header untouched).
 */
export function AuthHero({ icon, title, subtitle }: { icon: ReactNode; title: string; subtitle: string }) {
  return (
    <div className="relative flex flex-col items-center pt-2 text-center">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[-34px] h-[170px] w-[380px] -translate-x-1/2"
        style={{
          backgroundImage:
            "linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)",
          backgroundSize: "34px 34px",
          backgroundPosition: "center",
          maskImage: "radial-gradient(closest-side, black, transparent)",
          WebkitMaskImage: "radial-gradient(closest-side, black, transparent)",
        }}
      />
      <span aria-hidden className="absolute left-[calc(50%-119px)] top-0 h-[34px] w-[34px] bg-link/[0.07]" />
      <span aria-hidden className="absolute left-[calc(50%+85px)] top-[-34px] h-[34px] w-[34px] bg-link/[0.07]" />

      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-[#4772FF] text-white shadow-[0_14px_30px_-10px_rgba(71,114,255,0.7)]">
        {icon}
      </div>

      <h1 className="relative mt-5 text-[28px] font-semibold leading-tight tracking-tight text-foreground sm:text-[32px]">
        {title}
      </h1>
      <p className="relative mt-2.5 max-w-sm text-[15px] leading-relaxed text-muted">{subtitle}</p>
    </div>
  );
}

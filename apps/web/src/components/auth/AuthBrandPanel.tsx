import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { DashboardIllustration, TrendIllustration } from "@/components/illustrations/ProductIllustration";
import { Logo } from "@/components/Logo";
import { cn } from "@/lib/cn";

const VARIANTS = {
  login: {
    illustration: <DashboardIllustration />,
    heading: (
      <>
        Every rupee,
        <br />
        <span className="text-accent-text">one clear plan.</span>
      </>
    ),
    subcopy: "Taxes, investments and goals — tracked together, not scattered across five apps.",
    checklist: [
      "Form 16, AIS and 26AS matched automatically",
      "Old vs new regime compared for you, every year",
      "Investments and goals tracked in one place",
    ],
  },
  signup: {
    illustration: <TrendIllustration />,
    heading: (
      <>
        Your money deserves
        <br />
        <span className="text-accent-text">a clearer picture.</span>
      </>
    ),
    subcopy: "Bring your income, taxes, investments and documents together — understand where you stand.",
    checklist: [
      "Connect payslips, Form 16 and bank data safely",
      "See where your money stands in minutes",
      "Read-only access, encrypted end to end",
    ],
  },
} satisfies Record<string, { illustration: ReactNode; heading: ReactNode; subcopy: string; checklist: string[] }>;

/**
 * Light-mode-only brand panel for the auth screens: a flat illustration,
 * headline and value-prop checklist on a plain card surface — dark mode
 * keeps its own separate photo-showcase layout untouched.
 * Palette/typography intentionally mirror the landing page's light mode
 * (navy + lime, `text-link` reserved for real links, shared `text-h1` scale)
 * rather than introducing a one-off auth-screen palette.
 */
export function AuthBrandPanel({
  variant,
  className,
}: {
  variant: keyof typeof VARIANTS;
  className?: string;
}) {
  const content = VARIANTS[variant];

  return (
    <div
      className={cn(
        "relative isolate hidden flex-col overflow-hidden rounded-3xl border border-line bg-card lg:flex",
        className,
      )}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "26px 26px",
          maskImage: "radial-gradient(ellipse 70% 55% at 30% 20%, black, transparent 72%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 55% at 30% 20%, black, transparent 72%)",
        }}
      />

      <div className="relative flex flex-1 flex-col p-10 xl:p-12">
        {content.illustration}

        <h2 className="mt-7 max-w-xs text-h1 text-foreground">{content.heading}</h2>
        <p className="mt-2 max-w-xs text-sm text-muted">{content.subcopy}</p>

        <ul className="mt-6 flex flex-col gap-3">
          {content.checklist.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-sm text-foreground">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent-text" strokeWidth={2} />
              {item}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-line/70 pt-6">
          <Logo height={22} />
          <p className="text-[11px] text-muted">Read-only access · Encrypted end to end · Your data is never sold</p>
        </div>
      </div>
    </div>
  );
}

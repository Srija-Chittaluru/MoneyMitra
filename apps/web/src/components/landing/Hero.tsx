import { ArrowRight, Check } from "lucide-react";
import { ProductMockup } from "./ProductMockup";
import { Container, LinkButton } from "./parts";

const HIGHLIGHTS = [
  "Old & new regime, side by side",
  "FY 2025-26 tax rules",
  "Payslips, Form 16 & proofs",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden">
      {/* Faint dot grid, faded out toward the edges */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          backgroundImage:
            "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage:
            "radial-gradient(ellipse 70% 60% at 65% 35%, black, transparent 75%)",
          WebkitMaskImage:
            "radial-gradient(ellipse 70% 60% at 65% 35%, black, transparent 75%)",
        }}
      />

      <Container className="grid grid-cols-1 items-center gap-12 pb-14 pt-12 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pb-20 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-caption text-muted">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Built for Indian salaried users
          </span>

          <h1 className="text-[40px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[48px] lg:text-display">
            Your money, finally in one place.
          </h1>

          <p className="max-w-xl text-body text-muted md:text-lg">
            MoneyMitra helps you understand your taxes, organize your financial
            documents, compare tax regimes, and get personalized guidance — in
            one calm, clear workspace.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <LinkButton href="/signup">
              Get started
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton href="#how-it-works" variant="secondary">
              See how it works
            </LinkButton>
          </div>

          <ul className="mt-2 flex flex-col gap-2 text-sm text-muted sm:flex-row sm:flex-wrap sm:gap-x-5">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <Check className="h-4 w-4 text-link" strokeWidth={2} />
                {item}
              </li>
            ))}
          </ul>
        </div>

        <ProductMockup />
      </Container>
    </section>
  );
}

import { ArrowRight } from "lucide-react";
import { ProductMockup } from "./ProductMockup";
import { Container, LinkButton, PhotoBackground } from "./parts";

export function Hero() {
  return (
    <section id="top" className="relative isolate overflow-hidden">
      {/* Dark mode: the mockup's night-sky photo. Light mode has no equivalent photography, so it gets a plain dot-grid instead. */}
      <PhotoBackground
        src="/landing/sky-moon.jpg"
        objectPosition="62% 45%"
        className="hidden -z-20 opacity-50 dark:block"
        priority
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 hidden bg-gradient-to-b from-background/55 via-background/10 to-background dark:block"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60 dark:hidden"
        style={{
          backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 60% at 65% 35%, black, transparent 75%)",
          WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 65% 35%, black, transparent 75%)",
        }}
      />

      <Container className="grid grid-cols-1 items-center gap-12 pb-14 pt-12 md:pt-16 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-10 lg:pb-20 lg:pt-20">
        <div className="flex flex-col items-start gap-6">
          <span
            data-hero-item="0"
            className="inline-flex items-center gap-2 rounded-full border border-line bg-card px-3 py-1 text-caption text-muted"
          >
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-accent" />
            Tax and money companion for salaried India
          </span>

          <h1
            data-hero-item="1"
            className="text-[40px] font-semibold leading-[1.06] tracking-[-0.03em] sm:text-[48px] lg:text-display"
          >
            Understand your money.
            <br />
            <span className="text-accent-text">Make your next move.</span>
          </h1>

          <p data-hero-item="2" className="max-w-xl text-body text-muted md:text-lg">
            MoneyMitra reads your payslips, Form 16, bank and investment data, works out what it means for
            you, and tells you the next smart thing to do. All year, not just in July.
          </p>

          <div data-hero-item="3" className="flex flex-wrap items-center gap-3">
            <LinkButton href="/signup">
              Get started
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <LinkButton href="#how" variant="secondary">
              See how it works
            </LinkButton>
          </div>
        </div>

        <ProductMockup />
      </Container>
    </section>
  );
}

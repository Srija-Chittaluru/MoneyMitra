import { ArrowRight } from "lucide-react";
import { Container, LinkButton } from "./parts";

export function FinalCta() {
  return (
    <section className="pb-20 md:pb-28">
      <Container>
        {/* `dark` scopes the Ink Navy tokens to this panel only, matching CardDark's pattern */}
        <div data-reveal className="dark relative overflow-hidden rounded-lg bg-background px-6 py-16 text-center text-foreground md:py-24">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              maskImage:
                "radial-gradient(ellipse 60% 70% at 50% 50%, black, transparent 80%)",
              WebkitMaskImage:
                "radial-gradient(ellipse 60% 70% at 50% 50%, black, transparent 80%)",
            }}
          />
          <div className="relative mx-auto flex max-w-3xl flex-col items-center gap-6">
            <h2 className="text-[32px] font-semibold leading-[1.1] tracking-[-0.03em] md:text-[56px]">
              Understand your money. <span className="text-accent-text">Make your next move.</span>
            </h2>
            <LinkButton href="/signup" className="mt-2">
              Get started
              <ArrowRight className="h-4 w-4" />
            </LinkButton>
            <div className="flex flex-wrap items-center justify-center gap-x-7 gap-y-1 text-sm text-muted">
              <span>Read-only access to your accounts</span>
              <span>Encrypted end to end</span>
              <span>Your data is never sold</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

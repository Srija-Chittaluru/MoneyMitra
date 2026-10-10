import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container, Eyebrow, LinkButton } from "./parts";

interface PricingTier {
  name: string;
  price: string;
  cadence: string;
  description: string;
  bullets: string[];
  cta: string;
  highlighted?: boolean;
}

const TIERS: PricingTier[] = [
  {
    name: "Free",
    price: "₹0",
    cadence: "forever",
    description: "Understand where you stand — see it before you pay for help with it.",
    bullets: [
      "Dashboard and document uploads",
      "Old vs new regime comparison",
      "Manual ITR prep — download your JSON and PDF",
      "General recommendations",
    ],
    cta: "Get started free",
  },
  {
    name: "Assisted",
    price: "₹499",
    cadence: "per return",
    description: "Everything in Free, plus the app does the filing work for you.",
    bullets: [
      "Everything in Free",
      "ITR e-filing with AIS autofetch (ITR-1, 2, 3)",
      "Personalized recommendations — FDs, RDs, mutual funds, ETFs",
      "Goal planning with the Future Value Calculator",
      "Tax planning and Resources & Alerts",
      "1 CA call reviewing your return",
    ],
    cta: "Get started",
  },
  {
    name: "Premium",
    price: "₹1,999",
    cadence: "per return",
    description: "Full hand-holding — your return and your wider tax picture, in one call.",
    bullets: [
      "Everything in Assisted",
      "Tax regime comparison review",
      "Personalized recommendations review",
      "Tax planning walkthrough",
      "1 CA call covering all of it",
    ],
    cta: "Get started",
    highlighted: true,
  },
];

/**
 * "08 · Pricing" — lands right before the closing CTA. No payment button:
 * there's no checkout anywhere in this app, so every card links to signup;
 * the real plan picker (and the only place a request actually gets recorded)
 * is ExpertFilingPlans.tsx on the ITR page. Figures here mirror that
 * component's PLAN_DETAILS-backed prices exactly, not invented separately.
 */
export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 py-16 md:py-24">
      <Container>
        <div className="mb-14 flex flex-wrap items-end justify-between gap-8 md:mb-16">
          <div data-reveal className="flex max-w-xl flex-col gap-3">
            <Eyebrow>08 · Pricing</Eyebrow>
            <h2 className="text-h1 md:text-[44px]">
              Start free.
              <br />
              <span className="text-muted">Pay only if you want the CA.</span>
            </h2>
          </div>
          <p data-reveal className="max-w-sm text-body text-muted md:text-lg">
            Every plan includes the full app — recommendations, tax planning, goal planning and e-filing. The
            paid tiers add a CA on the phone when you want one.
          </p>
        </div>

        <div data-reveal className="grid gap-5 lg:grid-cols-3">
          {TIERS.map((tier) => (
            <div
              key={tier.name}
              className={cn(
                "flex flex-col gap-5 rounded-lg border border-line bg-card p-6",
                tier.highlighted && "ring-2 ring-accent",
              )}
            >
              <div>
                <p className="font-semibold text-foreground">{tier.name}</p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-[32px] font-semibold leading-none tracking-tight text-foreground">
                    {tier.price}
                  </span>
                  <span className="text-sm text-muted">{tier.cadence}</span>
                </div>
              </div>
              <p className="text-sm text-muted">{tier.description}</p>
              <ul className="flex flex-1 flex-col gap-2 text-sm text-foreground">
                {tier.bullets.map((bullet) => (
                  <li key={bullet} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                    {bullet}
                  </li>
                ))}
              </ul>
              <LinkButton href="/signup" variant={tier.highlighted ? "primary" : "secondary"}>
                {tier.cta}
              </LinkButton>
            </div>
          ))}
        </div>

        <p data-reveal className="mt-6 text-sm text-muted">
          Paid plans are requested from inside the app, on the ITR filing page — our team calls to confirm and
          take payment, nothing is charged automatically.
        </p>
      </Container>
    </section>
  );
}

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
    description: "Understand your taxes yourself.",
    bullets: [
      "ITR filing with JSON + PDF download — you upload it on incometax.gov.in",
      "Tax comparison (old vs new regime)",
      "Market overview — Nifty 50, gold, silver, and how FDs, RDs, mutual funds and ETFs have performed",
    ],
    cta: "Get started free",
  },
  {
    name: "Assisted",
    price: "₹499",
    cadence: "a year",
    description: "MoneyMitra does it for you.",
    bullets: [
      "Everything in Free",
      "Auto-fill from your documents — Form 16, AIS, payslips, broker statements",
      "e-filing from MoneyMitra — no download or re-upload",
      "Personalised options — FDs, RDs, mutual funds and ETFs matched to your age and income, compared side by side",
      "Tax planning — deduction room and deadline alerts",
    ],
    cta: "Get started",
  },
  {
    name: "Premium",
    price: "₹1,999",
    cadence: "a year",
    description: "A CA in your corner, all year.",
    bullets: [
      "Everything in Assisted",
      "CA reviews your return before it's filed — 1 call",
      "Our best pick — the one FD, RD, fund or ETF, and the amount, matched to your finances",
      "Year-round: a mid-year tax check (around December, before the March investment deadline) plus priority chat with the CA",
      "Notices covered — if the tax department sends a notice about a return we filed, the CA helps you reply",
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
            Free gets you started on your own. Assisted adds the automation — auto-fill, e-filing, personalised
            picks. Premium adds a CA on the phone, all year.
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
        <p data-reveal className="mt-2 text-sm text-muted">Coming soon: invest directly from MoneyMitra.</p>
      </Container>
    </section>
  );
}

import { Scale, ScanSearch, Sparkles, Upload } from "lucide-react";
import { Container, Eyebrow } from "./parts";

const STEPS = [
  {
    icon: Upload,
    title: "Upload",
    description: "Add your payslips, Form 16 and tax proofs whenever you have them.",
  },
  {
    icon: ScanSearch,
    title: "Understand",
    description: "MoneyMitra reads each document and pulls out the numbers that matter.",
  },
  {
    icon: Scale,
    title: "Compare",
    description: "See your tax under the old and new regimes, side by side.",
  },
  {
    icon: Sparkles,
    title: "Recommend",
    description: "Get clear next steps, each with the reason behind it.",
  },
];

export function HowItWorks() {
  return (
    <section
      id="how-it-works"
      className="scroll-mt-16 border-y border-border bg-surface py-16 md:py-24"
    >
      <Container>
        <div className="mb-12 flex max-w-2xl flex-col gap-3 md:mb-16">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="text-h1 md:text-[40px]">
            From paperwork to clarity in four steps.
          </h2>
        </div>

        <ol className="grid grid-cols-1 gap-10 md:grid-cols-4 md:gap-6">
          {STEPS.map(({ icon: Icon, title, description }, i) => (
            <li key={title} className="relative flex gap-4 md:flex-col md:gap-5">
              {/* connector: vertical on mobile, horizontal on desktop */}
              {i < STEPS.length - 1 && (
                <>
                  <span
                    aria-hidden
                    className="absolute left-6 top-14 h-[calc(100%-2rem)] w-px bg-border md:hidden"
                  />
                  <span
                    aria-hidden
                    className="absolute left-16 right-0 top-6 hidden h-px bg-border md:block"
                  />
                </>
              )}
              <span className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-[0_1px_2px_rgba(11,15,20,0.06)]">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="flex flex-col gap-1.5 pr-2">
                <p className="flex items-center gap-2 text-h2">
                  <span className="text-sm font-medium text-muted">
                    0{i + 1}
                  </span>
                  {title}
                </p>
                <p className="text-body text-muted">{description}</p>
              </div>
            </li>
          ))}
        </ol>
      </Container>
    </section>
  );
}

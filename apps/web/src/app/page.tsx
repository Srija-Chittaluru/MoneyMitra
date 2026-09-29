import Link from "next/link";
import { Scale, Sparkles, Wallet, ScanSearch } from "lucide-react";
import { PublicHeader } from "@/components/shell/PublicHeader";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

const CAPABILITIES = [
  {
    icon: Scale,
    title: "Old vs. New regime comparison",
    description: "See exactly how much tax you'd pay under each regime, side by side.",
  },
  {
    icon: ScanSearch,
    title: "Document extraction",
    description: "Upload payslips, Form 16, and proofs — we pull out the numbers that matter.",
  },
  {
    icon: Sparkles,
    title: "Tax-saving recommendations",
    description: "Clear, explained suggestions based on your actual income and deductions.",
  },
  {
    icon: Wallet,
    title: "Finance management",
    description: "Track spending, investments, and savings alongside your tax picture.",
  },
];

const STEPS = [
  {
    step: "1",
    title: "Upload your documents",
    description: "Payslips, Form 16, and tax proofs — as and when you have them.",
  },
  {
    step: "2",
    title: "We extract and analyze",
    description: "Structured data comes out; deterministic tax rules run on top of it.",
  },
  {
    step: "3",
    title: "See your comparison and recommendations",
    description: "Old vs. new regime, tax-saving ideas, and life-stage guidance in one place.",
  },
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <PublicHeader />

      <main className="flex-1">
        <section className="mx-auto flex max-w-3xl flex-col items-center gap-6 px-4 py-20 text-center md:py-28">
          <p className="text-display">
            Understand your taxes.
            <br />
            Manage your money.
          </p>
          <p className="max-w-xl text-body text-muted">
            MoneyMitra helps Indian salaried users understand and manage their
            taxes and personal finances — compare tax regimes, track
            documents, and get tax-saving and life-stage guidance in one
            place.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link href="/signup">
              <Button variant="primary">Get started</Button>
            </Link>
            <Link href="/login">
              <Button variant="secondary">Log in</Button>
            </Link>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 md:py-16">
          <h2 className="text-h1 mb-8 text-center">What MoneyMitra does</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {CAPABILITIES.map(({ icon: Icon, title, description }) => (
              <Card key={title} className="flex flex-col gap-3">
                <Icon className="h-6 w-6 text-link" strokeWidth={1.75} />
                <h3 className="text-h2">{title}</h3>
                <p className="text-body text-muted">{description}</p>
              </Card>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 md:py-16">
          <h2 className="text-h1 mb-8 text-center">How it works</h2>
          <div className="grid gap-6 sm:grid-cols-3">
            {STEPS.map(({ step, title, description }) => (
              <div key={step} className="flex flex-col items-center gap-3 text-center">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary font-mono text-primary-foreground">
                  {step}
                </span>
                <h3 className="text-h2">{title}</h3>
                <p className="text-body text-muted">{description}</p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-border bg-surface px-4 py-8 md:px-8">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 sm:flex-row">
          <Logo height={24} />
          <p className="text-sm text-muted">
            &copy; {new Date().getFullYear()} MoneyMitra. Built for Indian
            salaried users.
          </p>
          <div className="flex gap-4 text-sm">
            <Link href="/login" className="text-link">
              Log in
            </Link>
            <Link href="/signup" className="text-link">
              Sign up
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

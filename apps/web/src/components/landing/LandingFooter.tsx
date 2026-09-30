import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Container } from "./parts";

export function LandingFooter() {
  return (
    <footer
      id="about"
      className="scroll-mt-16 border-t border-border bg-surface py-12 md:py-16"
    >
      <Container>
        <div className="grid grid-cols-1 gap-10 md:grid-cols-[1.6fr_1fr_1fr]">
          <div className="flex max-w-sm flex-col gap-4">
            <Logo height={28} />
            <p className="text-sm text-muted">
              MoneyMitra is a personal financial assistant for Indian salaried
              professionals — a calmer way to understand taxes, organize
              documents and manage money.
            </p>
          </div>

          <nav aria-label="Product" className="flex flex-col gap-3 text-sm">
            <p className="font-semibold text-foreground">Product</p>
            <a href="#features" className="text-muted hover:text-foreground">
              Features
            </a>
            <a href="#how-it-works" className="text-muted hover:text-foreground">
              How it works
            </a>
            <a href="#product" className="text-muted hover:text-foreground">
              Product tour
            </a>
          </nav>

          <nav aria-label="Account" className="flex flex-col gap-3 text-sm">
            <p className="font-semibold text-foreground">Account</p>
            <Link href="/login" className="text-muted hover:text-foreground">
              Log in
            </Link>
            <Link href="/signup" className="text-muted hover:text-foreground">
              Get started
            </Link>
          </nav>
        </div>

        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} MoneyMitra. Built for Indian
            salaried users.
          </p>
          <p>Figures on this page are demo data for illustration only.</p>
        </div>
      </Container>
    </footer>
  );
}

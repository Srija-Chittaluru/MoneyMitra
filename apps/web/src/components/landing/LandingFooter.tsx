import { Logo } from "@/components/Logo";
import { Container } from "./parts";

export function LandingFooter() {
  return (
    <footer id="about" className="scroll-mt-16 border-t border-line bg-card py-10">
      <Container className="flex flex-col flex-wrap items-center justify-between gap-5 sm:flex-row">
        <div className="flex items-center gap-2.5">
          <Logo height={28} />
          <span className="text-sm text-muted">&copy; {new Date().getFullYear()}</span>
        </div>
        <nav aria-label="Legal" className="flex flex-wrap gap-6 text-sm text-muted">
          <a href="#top" className="hover:text-foreground">
            Privacy
          </a>
          <a href="#top" className="hover:text-foreground">
            Terms
          </a>
          <a href="#top" className="hover:text-foreground">
            Security
          </a>
          <a href="#top" className="hover:text-foreground">
            Contact
          </a>
        </nav>
      </Container>
      <Container>
        <p className="mt-6 border-t border-line pt-4 text-xs text-muted">
          Figures on this page are demo data for illustration only.
        </p>
      </Container>
    </footer>
  );
}

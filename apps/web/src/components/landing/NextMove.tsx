import { PERSONAS } from "./demo-data";
import { Container, Eyebrow } from "./parts";

/** "Different lives. The next move that fits yours." Three persona cards, verbatim from the design. */
export function NextMove() {
  return (
    <section aria-label="The next move that fits you" className="py-16 md:py-24">
      <Container>
        <div data-reveal className="mb-14 flex max-w-2xl flex-col gap-3 md:mb-16">
          <Eyebrow>06 · Your next move</Eyebrow>
          <h2 className="text-h1 md:text-[44px]">
            Different lives.
            <br />
            <span className="text-muted">The next move that fits yours.</span>
          </h2>
          <p className="text-body text-muted md:text-lg">
            Mitra looks at where you stand today and suggests the one action that&apos;s most relevant right
            now.
          </p>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {PERSONAS.map((p) => (
            <div key={p.name} data-reveal className="flex flex-col gap-4 rounded-lg border border-line bg-card p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-field text-base font-medium text-foreground">
                  {p.initial}
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted">{p.role}</p>
                </div>
                <span className="ml-auto text-2xl font-semibold text-muted">{p.age}</span>
              </div>

              <div className="rounded-md bg-field p-3.5">
                <p className="mb-2.5 font-mono text-[10px] tracking-wide text-muted">What Mitra sees</p>
                {p.facts.map((fact) => (
                  <div key={fact.k} className="flex justify-between py-1 text-xs text-muted">
                    <span>{fact.k}</span>
                    <span className="font-mono text-foreground">{fact.v}</span>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-accent/35 bg-field p-4">
                <p className="mb-2.5 flex items-center gap-1.5 text-xs text-accent-text">Next move</p>
                <p className="text-base leading-snug tracking-tight text-foreground">{p.line1}</p>
                <p className="mt-1.5 text-sm text-muted">{p.line2}</p>
                <p className="mt-4 text-2xl font-semibold tracking-tight text-accent-text">{p.big}</p>
                <p className="mt-0.5 text-xs text-muted">{p.sub}</p>
                <div className="mt-4 flex h-11 items-center justify-center rounded-md bg-accent text-sm font-semibold text-accent-foreground">
                  {p.action}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

import { cn } from "@/lib/cn";
import { SCATTERED_SOURCES } from "./demo-data";
import { Container, Eyebrow } from "./parts";

/**
 * "Your financial life is scattered everywhere." A static (not scroll-jacked)
 * grid of source cards around a center "MoneyMitra" card — the same
 * "many sources, one picture" idea the mockup conveys with physics-based
 * scroll animation, done here with the existing `data-reveal` stagger instead.
 */
export function Problem() {
  return (
    <section aria-label="The problem" className="py-16 md:py-24">
      <Container>
        <div data-reveal className="mx-auto mb-14 flex max-w-2xl flex-col items-center gap-3 text-center md:mb-20">
          <Eyebrow>02 · The problem</Eyebrow>
          <h2 className="text-h1 md:text-[44px]">Your financial life is scattered everywhere.</h2>
          <p className="text-body text-muted md:text-lg">
            MoneyMitra brings the pieces together so you can understand the whole picture.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7">
          {SCATTERED_SOURCES.map((source) => (
            <div
              key={source.label}
              data-reveal
              className="flex flex-col gap-2 rounded-lg border border-line bg-card p-3.5"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-medium text-foreground">{source.label}</span>
                {source.tag && (
                  <span
                    className={cn(
                      "shrink-0 font-mono text-[10px]",
                      source.tagTone === "warning" ? "text-warning" : "text-muted",
                    )}
                  >
                    {source.tag}
                  </span>
                )}
              </div>
              <div>
                <p className="text-[11px] text-muted">{source.detail}</p>
                <p className="mt-0.5 font-mono text-sm text-foreground">{source.value}</p>
              </div>
            </div>
          ))}

          <div
            data-reveal
            className="col-span-2 flex flex-col items-center justify-center gap-2 rounded-lg border border-accent/40 bg-field p-3.5 text-center sm:col-span-1"
          >
            <span className="font-semibold text-foreground">MoneyMitra</span>
            <span className="font-mono text-[10px] text-accent-text">{SCATTERED_SOURCES.length} of {SCATTERED_SOURCES.length} connected</span>
          </div>
        </div>
      </Container>
    </section>
  );
}

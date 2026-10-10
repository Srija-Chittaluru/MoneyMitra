import { cn } from "@/lib/cn";

export interface RevealLine {
  id: string;
  title: string;
  line: string;
  status: string;
  statusClassName: string;
}

export interface RevealRec {
  what: string;
  why: string;
  impact: string;
}

/** The wizard's final screen: one line per goal's projection, plus a single recommended first move. */
export function StepReveal({ lines, rec }: { lines: RevealLine[]; rec?: RevealRec }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-hidden rounded-2xl border border-line">
        {lines.length === 0 ? (
          <div className="bg-field p-5 text-sm text-muted">
            No goals yet. That&apos;s fine. You can add them any time from your journey.
          </div>
        ) : (
          lines.map((l, i) => (
            <div
              key={l.id}
              className={cn("flex flex-wrap items-center gap-3.5 bg-field px-5 py-4", i > 0 && "border-t border-line")}
            >
              <div className="min-w-[160px] flex-1">
                <div className="text-base font-semibold text-foreground">{l.title}</div>
                <div className="mt-0.5 text-sm text-muted">{l.line}</div>
              </div>
              <div className={cn("font-mono text-sm", l.statusClassName)}>{l.status}</div>
            </div>
          ))
        )}
      </div>

      {rec && (
        <div className="flex flex-col gap-1.5 rounded-2xl border border-[#3155E0]/40 bg-field p-5 dark:border-[#7B9AFF]/40">
          <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#3155E0] dark:text-[#7B9AFF]">
            Your first next move
          </p>
          <p className="mt-1 text-base font-semibold text-foreground">{rec.what}</p>
          <p className="text-sm text-muted">{rec.why}</p>
          <p className="mt-0.5 font-mono text-sm text-success">{rec.impact}</p>
        </div>
      )}
    </div>
  );
}

import { FileText, Scale, Sparkles, Wallet } from "lucide-react";
import { cn } from "@/lib/cn";
import { Container } from "./parts";

const AREAS = [
  { icon: Scale, label: "Tax", caption: "Compare regimes" },
  { icon: FileText, label: "Documents", caption: "Organize & extract" },
  { icon: Sparkles, label: "Recommendations", caption: "Save, with reasons" },
  { icon: Wallet, label: "Finance", caption: "Track it all" },
];

/* 1 column on the narrowest phones, 2 from 360px, 4 on desktop */
const BORDERS = [
  "",
  "border-t border-border min-[360px]:border-l min-[360px]:border-t-0 lg:border-l",
  "border-t border-border lg:border-l lg:border-t-0",
  "border-t border-border min-[360px]:border-l lg:border-l lg:border-t-0",
];

export function ValueStrip() {
  return (
    <section aria-label="What MoneyMitra covers" className="pb-16 md:pb-24">
      <Container>
        <ul className="grid grid-cols-1 overflow-hidden min-[360px]:grid-cols-2 rounded-lg border border-border bg-surface lg:grid-cols-4">
          {AREAS.map(({ icon: Icon, label, caption }, i) => (
            <li
              key={label}
              data-reveal
              className={cn(
                "flex items-center gap-2.5 px-3 py-4 sm:gap-3 sm:px-6 sm:py-5",
                BORDERS[i],
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-muted text-foreground sm:h-10 sm:w-10">
                <Icon className="h-5 w-5" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-foreground sm:text-base">
                  {label}
                </p>
                <p className="truncate text-xs text-muted sm:text-sm">
                  {caption}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}

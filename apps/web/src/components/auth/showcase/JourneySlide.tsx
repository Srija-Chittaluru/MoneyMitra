import { cn } from "@/lib/cn";

const GOALS = [
  { label: "GOAL · 2027", title: "Emergency fund", status: "On track", left: "44%", tone: "success" as const },
  { label: "GOAL · 2030", title: "Home down payment", status: "Behind by 4 mo", left: "76%", tone: "error" as const },
];

const TONE_CLASSES = {
  success: { flag: "bg-success", text: "text-success" },
  error: { flag: "bg-error", text: "text-error" },
};

const GROUND_HEIGHT = 52;

/**
 * A static preview of the real "My Journey" timeline — same checkerboard
 * ground, flag markers and pixel character as the in-app component, just
 * fixed rather than built from real milestones. Shown pre-login, so the
 * goal figures here are illustrative, not implying anyone's actual data.
 */
export function JourneySlide() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative h-[220px] w-full max-w-[560px] overflow-hidden rounded-[22px] border border-line bg-card shadow-[0_30px_70px_-26px_rgba(11,15,20,0.3)]">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage: "radial-gradient(var(--border) 1px, transparent 1.4px)",
            backgroundSize: "16px 16px",
          }}
        />

        {/* Dashed "projection" line running from the character into the future */}
        <div
          aria-hidden
          className="absolute left-[24%] right-0 border-t-2 border-dashed border-[#3155E0]/50 dark:border-[#7B9AFF]/50"
          style={{ bottom: GROUND_HEIGHT }}
        />

        {/* Ground strip — painted before the goal markers so their poles/flags sit visibly on top */}
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 border-t-2 border-border"
          style={{
            height: GROUND_HEIGHT,
            backgroundImage: "repeating-conic-gradient(var(--surface-muted) 0 25%, var(--surface) 0 50%)",
            backgroundSize: "16px 16px",
          }}
        />

        {GOALS.map((goal) => {
          const tone = TONE_CLASSES[goal.tone];
          return (
            <div
              key={goal.title}
              className="absolute top-5 flex -translate-x-1/2 flex-col items-center"
              style={{ left: goal.left }}
            >
              <div className="w-[148px] rounded-[14px] border border-line bg-card p-2.5 text-left shadow-md">
                <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted">{goal.label}</p>
                <p className="mt-1 text-[13px] font-semibold leading-snug text-foreground">{goal.title}</p>
                <p className={cn("mt-0.5 font-mono text-[11px]", tone.text)}>{goal.status}</p>
              </div>
              <span aria-hidden className="h-16 w-px shrink-0 bg-border" />
              <span aria-hidden className={cn("h-2.5 w-3.5 shrink-0 rounded-[1px]", tone.flag)} />
            </div>
          );
        })}

        {/* Character, rendered at 2x the sprite sheet's native 48px frame —
            image-rendering:pixelated keeps an integer scale crisp. */}
        <div
          aria-hidden
          className="absolute h-24 w-24 bg-[url('/journey/characters/biker/idle.png')] bg-[length:400%_100%] bg-left bg-no-repeat [image-rendering:pixelated]"
          style={{
            left: "14%",
            bottom: GROUND_HEIGHT - 2,
            transform: "translateX(-50%)",
            animation: "mm-journey-idle 0.8s steps(4) infinite",
          }}
        />
        <p className="absolute bottom-[18px] left-[14%] -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.14em] text-[#3155E0] dark:text-[#7B9AFF]">
          Now
        </p>

        <style>{`
          @keyframes mm-journey-idle {
            from { background-position-x: 0%; }
            to { background-position-x: 100%; }
          }
        `}</style>
      </div>
    </div>
  );
}

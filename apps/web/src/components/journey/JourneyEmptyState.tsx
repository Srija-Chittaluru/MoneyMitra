"use client";

import { Button } from "@/components/ui/Button";
import { getCharacter } from "@/lib/journey/characters";
import { CharacterSprite, CharacterSpriteStyles } from "./CharacterSprite";

/** Shown once, before a journey exists — mirrors the prototype's hero scene. */
export function JourneyEmptyState({ onStart, onLater }: { onStart: () => void; onLater: () => void }) {
  const hero = getCharacter("biker");

  return (
    <div className="flex flex-col items-center gap-9 rounded-3xl border border-line bg-card p-10 text-center shadow-sm">
      <div className="relative h-44 w-full max-w-xl overflow-hidden rounded-2xl border border-line bg-field">
        <div
          aria-hidden
          className="absolute inset-0 opacity-60"
          style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
        />
        <div
          aria-hidden
          className="absolute rounded-full bg-[#3155E0]/15 blur-3xl dark:bg-[#7B9AFF]/15"
          style={{ left: "10%", top: "30%", width: 220, height: 220 }}
        />
        <div
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-10 border-t-2 border-border"
          style={{
            backgroundImage: "repeating-conic-gradient(var(--surface-muted) 0 25%, var(--surface) 0 50%)",
            backgroundSize: "14px 14px",
          }}
        />
        <div aria-hidden className="absolute left-[22%] right-[6%] bottom-10 border-t-2 border-dashed border-[#3155E0]/45 dark:border-[#7B9AFF]/45" />
        <div className="absolute bottom-6 left-[14%] -translate-x-1/2">
          <CharacterSprite src={hero.idleSrc} frames={hero.idleFrames} fps={6} size={64} />
        </div>
        <span className="absolute bottom-3 left-[14%] -translate-x-1/2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
          Start
        </span>
        <span className="absolute bottom-3 right-[6%] font-mono text-[11px] uppercase tracking-[0.14em] text-muted">?</span>
      </div>

      <div className="flex max-w-lg flex-col items-center gap-3">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">My journey</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">Every journey starts somewhere.</h1>
        <p className="text-base text-muted">Let&apos;s figure out where you are and where you want to go.</p>
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" size="md" className="rounded-full" onClick={onStart}>
          Start my journey
        </Button>
        <Button variant="secondary" size="md" className="rounded-full" onClick={onLater}>
          I&apos;ll do this later
        </Button>
      </div>
      <CharacterSpriteStyles />
    </div>
  );
}

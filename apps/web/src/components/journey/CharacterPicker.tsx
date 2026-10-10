"use client";

import { cn } from "@/lib/cn";
import { CHARACTERS, type CharacterId } from "@/lib/journey/characters";
import { CharacterSprite, CharacterSpriteStyles } from "./CharacterSprite";

export function CharacterPicker({
  selectedId,
  onSelect,
}: {
  selectedId: CharacterId | null;
  onSelect: (id: CharacterId) => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-card p-8 shadow-sm">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-muted">My journey</p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
        Pick who walks your journey
      </h2>
      <p className="mt-2 text-sm text-muted">This is you, not Mitra — you can change it any time.</p>

      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {CHARACTERS.map((c) => {
          const isSelected = c.id === selectedId;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect(c.id)}
              className={cn(
                "flex flex-col items-center gap-3 rounded-2xl border-2 bg-field py-6 transition-all",
                isSelected
                  ? "border-[#3155E0] bg-[#3155E0]/5 shadow-[0_0_0_4px_rgba(49,85,224,0.18)] dark:border-[#7B9AFF] dark:bg-[#7B9AFF]/10 dark:shadow-[0_0_0_4px_rgba(123,154,255,0.18)]"
                  : "border-line hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50",
              )}
            >
              <div className="flex h-28 items-end justify-center">
                <CharacterSprite src={c.idleSrc} frames={c.idleFrames} size={96} />
              </div>
              <span className="text-base font-semibold text-foreground">{c.label}</span>
            </button>
          );
        })}
      </div>
      <CharacterSpriteStyles />
    </div>
  );
}

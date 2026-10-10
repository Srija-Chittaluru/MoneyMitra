import { cn } from "@/lib/cn";
import { CHARACTERS, type CharacterId } from "@/lib/journey/characters";
import { CharacterSprite, CharacterSpriteStyles } from "../CharacterSprite";

/** The wizard's character-pick step — same grid as `CharacterPicker`, without its own panel chrome (the wizard shell provides that). */
export function StepHello({ selectedId, onSelect }: { selectedId: CharacterId; onSelect: (id: CharacterId) => void }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
      <CharacterSpriteStyles />
    </div>
  );
}

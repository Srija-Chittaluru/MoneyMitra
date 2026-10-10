"use client";

import { Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { getCharacter, type CharacterId } from "@/lib/journey/characters";
import type { JourneyMilestone } from "@/lib/journey/types";

// The character never moves across the stage — it stands permanently at
// "now" and just idles there, very slowly, so it reads as steady rather
// than as a figure walking or shuffling around.
const IDLE_FPS = 1;

const CARD_WIDTH = 176; // matches w-44 below
const MIN_GAP = 28;
const EDGE_PADDING = CARD_WIDTH / 2 + 24;
const TRACK_WIDTH_PER_MILESTONE = 190;
const TRACK_MIN_WIDTH = 760;
const TRACK_HEIGHT = 260;
const GROUND_Y = 160;
// 2x the sprite sheet's native 48px frame — image-rendering:pixelated keeps
// integer multiples crisp, so this reads as a real character, not an icon.
const CHAR_SPRITE_SIZE = 96;

function fractionOf(milestone: JourneyMilestone, earliest: number, latest: number): number {
  if (latest === earliest) return 0.5;
  return (Date.parse(milestone.date) - earliest) / (latest - earliest);
}

/**
 * Positions milestones proportionally to their real dates, then enforces a
 * minimum pixel gap between neighbours so markers close in time (a new
 * account's "joined" and "now", say) never overlap. The track widens to fit
 * if collision-avoidance needs more room than the date spread implies. A
 * trailing "add a goal" slot is appended at the end, same spacing rule.
 */
function layoutMilestones(milestones: JourneyMilestone[]) {
  const dates = milestones.map((m) => Date.parse(m.date));
  const earliest = Math.min(...dates);
  const latest = Math.max(...dates);

  let trackWidth = Math.max(TRACK_MIN_WIDTH, (milestones.length + 1) * TRACK_WIDTH_PER_MILESTONE);
  const usableWidth = trackWidth - EDGE_PADDING * 2;
  const positions = milestones.map((m) => EDGE_PADDING + fractionOf(m, earliest, latest) * usableWidth);
  for (let i = 1; i < positions.length; i++) {
    const minX = positions[i - 1] + CARD_WIDTH + MIN_GAP;
    if (positions[i] < minX) positions[i] = minX;
  }
  const ghostX = (positions[positions.length - 1] ?? EDGE_PADDING) + CARD_WIDTH + MIN_GAP;
  const rightmost = ghostX + EDGE_PADDING;
  if (rightmost > trackWidth) trackWidth = rightmost;

  const positionById = new Map(milestones.map((m, i) => [m.id, positions[i]]));
  return { trackWidth, positionById, ghostX };
}

/** past=success green, now=primary (navy/lime), future=a fixed signal-blue —
 * kept the same hex in both themes (unlike --link, which turns lime in dark)
 * so the three categories stay visually distinct regardless of theme. */
function markerClasses(when: JourneyMilestone["when"]) {
  if (when === "past") return { dot: "border-success bg-success", flag: "bg-success" };
  if (when === "now") return { dot: "border-primary bg-primary", flag: "bg-primary" };
  return {
    dot: "border-[#3155E0] bg-[#3155E0] dark:border-[#7B9AFF] dark:bg-[#7B9AFF]",
    flag: "bg-[#3155E0] dark:bg-[#7B9AFF]",
  };
}

export function JourneyTimeline({
  milestones,
  selectedId,
  onSelect,
  characterId,
  onAddGoal,
}: {
  milestones: JourneyMilestone[];
  selectedId: string;
  onSelect: (id: string) => void;
  characterId: CharacterId;
  onAddGoal: () => void;
}) {
  const hasMilestones = milestones.length > 0;
  const { trackWidth, positionById, ghostX } = hasMilestones
    ? layoutMilestones(milestones)
    : { trackWidth: 0, positionById: new Map<string, number>(), ghostX: 0 };
  const nowMilestone = milestones.find((m) => m.when === "now") ?? milestones[0];
  const nowX = nowMilestone ? (positionById.get(nowMilestone.id) ?? 0) : 0;

  if (!hasMilestones) return null;

  const character = getCharacter(characterId);

  return (
    <div className="overflow-hidden rounded-3xl border border-line bg-card shadow-sm">
      <div className="flex items-center justify-between px-6 pt-5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        <span>Past</span>
        <span>Future →</span>
      </div>

      <div className="overflow-x-auto px-6 pb-6 pt-8">
        {/* `max(...)` so the ground/sky fill the whole card on wide screens
            instead of stopping at the content width and leaving blank space
            past the last milestone — it only scrolls when content needs
            more room than the card actually has. */}
        <div className="relative" style={{ width: `max(${trackWidth}px, 100%)`, height: TRACK_HEIGHT }}>
          {/* Dot-grid texture across the whole stage, like the auth screens' backdrop */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-60"
            style={{
              backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)",
              backgroundSize: "20px 20px",
            }}
          />
          {/* Past shading */}
          <div aria-hidden className="absolute inset-y-0 left-0 bg-field/70" style={{ width: nowX }} />
          {/* Soft glow behind "now", in the same signal-blue as the selection halo */}
          <div
            aria-hidden
            className="absolute rounded-full bg-[#3155E0]/15 blur-3xl dark:bg-[#7B9AFF]/15"
            style={{ left: nowX - 150, top: GROUND_Y - 150, width: 300, height: 300 }}
          />

          {/* Ground strip — a subtle checkerboard "floor", same two tones as the panel chrome */}
          <div
            aria-hidden
            className="absolute left-0 right-0 border-t-2 border-border"
            style={{
              top: GROUND_Y,
              height: TRACK_HEIGHT - GROUND_Y,
              backgroundImage:
                "repeating-conic-gradient(var(--surface-muted) 0 25%, var(--surface) 0 50%)",
              backgroundSize: "16px 16px",
            }}
          />

          {/* The character stands permanently at "now" — it never slides
              around the stage when a different milestone is selected. */}
          <div
            aria-hidden
            className="absolute -translate-x-1/2"
            style={{ left: nowX, top: GROUND_Y + 4 - CHAR_SPRITE_SIZE }}
          >
            {/* Rendered at an integer multiple (2x) of the sprite sheet's
                native 48px frame — image-rendering:pixelated keeps scaled
                frames crisp, so this can be sized up without blur/bleed.
                A very low frame rate keeps this to a faint idle shift
                (a hand or a leg), not a visible shuffle. */}
            <div
              className="bg-no-repeat bg-left [image-rendering:pixelated]"
              style={{
                width: CHAR_SPRITE_SIZE,
                height: CHAR_SPRITE_SIZE,
                backgroundImage: `url('${character.idleSrc}')`,
                backgroundSize: `${character.idleFrames * 100}% 100%`,
                animation: `journey-walk ${character.idleFrames / IDLE_FPS}s steps(${character.idleFrames}) infinite`,
              }}
            />
          </div>

          {milestones.map((milestone) => {
            const x = positionById.get(milestone.id) ?? 0;
            const isSelected = milestone.id === selectedId;
            const Icon = milestone.icon;
            const marker = markerClasses(milestone.when);
            return (
              <div
                key={milestone.id}
                className="absolute top-0 flex -translate-x-1/2 flex-col items-center"
                style={{ left: x }}
              >
                <button
                  type="button"
                  onClick={() => onSelect(milestone.id)}
                  className={cn(
                    "flex w-44 min-h-[84px] flex-col justify-center rounded-xl border bg-card p-3 text-left shadow-sm transition-all",
                    isSelected
                      ? "border-[#3155E0] shadow-[0_0_0_4px_rgba(49,85,224,0.18)] dark:border-[#7B9AFF] dark:shadow-[0_0_0_4px_rgba(123,154,255,0.18)]"
                      : "border-line hover:border-[#3155E0]/50 dark:hover:border-[#7B9AFF]/50",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10">
                      <Icon className="h-3.5 w-3.5 text-accent-text" strokeWidth={2} />
                    </span>
                    <p className="font-mono text-[10px] uppercase tracking-[0.1em] text-muted">
                      {milestone.when === "now" ? "You are here" : milestone.when === "past" ? "Done" : "Ahead"}
                    </p>
                  </div>
                  <p className="mt-1.5 truncate text-sm font-semibold text-foreground">{milestone.title}</p>
                  {milestone.summary && <p className="mt-0.5 truncate text-xs text-muted">{milestone.summary}</p>}
                </button>

                {/* Pole connecting the card down to the ground, with a small flag at the base */}
                <span aria-hidden className="w-px shrink-0 bg-border" style={{ height: GROUND_Y - 84 }} />
                <span aria-hidden className={cn("h-[5px] w-3.5 shrink-0 rounded-[1px]", marker.flag)} />
                <span aria-hidden className={cn("mt-[3px] h-2.5 w-2.5 shrink-0 rounded-full border-2", marker.dot)} />
                <p className="mt-2 whitespace-nowrap text-[11px] text-muted">{milestone.dateLabel}</p>
              </div>
            );
          })}

          <div className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: ghostX }}>
            <button
              type="button"
              onClick={onAddGoal}
              className="flex w-44 min-h-[84px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-line p-3 text-center text-muted transition-colors hover:border-[#3155E0]/50 hover:text-foreground dark:hover:border-[#7B9AFF]/50"
            >
              <Plus className="h-4 w-4" strokeWidth={2} />
              <p className="text-xs font-medium">Add a goal</p>
            </button>
            <span aria-hidden className="w-px shrink-0 bg-border/50" style={{ height: GROUND_Y - 84 }} />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes journey-walk {
          from { background-position-x: 0%; }
          to { background-position-x: 100%; }
        }
      `}</style>
    </div>
  );
}

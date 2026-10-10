"use client";

import { cn } from "@/lib/cn";

/**
 * One animated frame-strip sprite (idle, run, …), all 48px-square frames laid
 * out horizontally in a single PNG. Rendered at native size with
 * image-rendering:pixelated so the browser never blurs/bleeds between frames.
 */
export function CharacterSprite({
  src,
  frames,
  fps = 6,
  size = 48,
  facing = "right",
  className,
}: {
  src: string;
  frames: number;
  /** Playback speed in frames per second. */
  fps?: number;
  /** Rendered width/height in px; sprite sheets are natively 48px square frames. */
  size?: number;
  facing?: "left" | "right";
  className?: string;
}) {
  const duration = frames / fps;
  return (
    <div
      aria-hidden
      className={cn("bg-no-repeat bg-left [image-rendering:pixelated]", className)}
      style={{
        width: size,
        height: size,
        backgroundImage: `url('${src}')`,
        backgroundSize: `${frames * 100}% 100%`,
        animation: `journey-sprite-frames ${duration}s steps(${frames}) infinite`,
        transform: facing === "left" ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

/** Mounted once is enough — a single global keyframe shared by every sprite instance. */
export function CharacterSpriteStyles() {
  return (
    <style>{`
      @keyframes journey-sprite-frames {
        from { background-position-x: 0%; }
        to { background-position-x: 100%; }
      }
    `}</style>
  );
}

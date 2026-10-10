export type CharacterId = "biker" | "punk" | "cyborg";

export interface CharacterConfig {
  id: CharacterId;
  label: string;
  idleSrc: string;
  idleFrames: number;
  runSrc: string;
  runFrames: number;
}

/** 48px-square frames, pulled from the free craftpix cyberpunk-characters pack. */
export const CHARACTERS: CharacterConfig[] = [
  {
    id: "biker",
    label: "Biker",
    idleSrc: "/journey/characters/biker/idle.png",
    idleFrames: 4,
    runSrc: "/journey/characters/biker/run.png",
    runFrames: 6,
  },
  {
    id: "punk",
    label: "Punk",
    idleSrc: "/journey/characters/punk/idle.png",
    idleFrames: 4,
    runSrc: "/journey/characters/punk/run.png",
    runFrames: 6,
  },
  {
    id: "cyborg",
    label: "Cyborg",
    idleSrc: "/journey/characters/cyborg/idle.png",
    idleFrames: 4,
    runSrc: "/journey/characters/cyborg/run.png",
    runFrames: 6,
  },
];

export const DEFAULT_CHARACTER_ID: CharacterId = "biker";

export function getCharacter(id: CharacterId): CharacterConfig {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

import type { TextureDef } from "./textureSchema";
import type { Song, SfxDef, MapMusicSettings, AudioTrackDef } from "./musicSchema";
import type { WeaponDef, WeaponPickup } from "./weaponSchema";
import type { EnemyDef } from "./enemySchema";
import type { PlayerDef } from "./playerSchema";
import type { IntroOutroConfig } from "./introSchema";

export const SCHEMA_VERSION = 1;

/** 0 = floor level, 1 = mid platform, 2 = raised platform — a doom-style step, not free-form height. */
export type HeightLevel = 0 | 1 | 2;

export const KEY_COLORS = ["red", "blue", "green", "yellow"] as const;
export type KeyColor = (typeof KEY_COLORS)[number];

export const KEY_COLOR_HEX: Record<KeyColor, string> = {
  red: "#c0392b",
  blue: "#2980b9",
  green: "#27ae60",
  yellow: "#f1c40f",
};

export const EXIT_COLOR_HEX = "#e84393";

export interface Cell {
  x: number;
  y: number;
  height: HeightLevel;
  wallTextureId: string | null;
  floorTextureId: string | null;
  ceilingTextureId: string | null;
  /** null = not a door. Otherwise this cell blocks movement like a wall, tinted by
   * key color, until the matching key opens it (see doorOpen). */
  doorColor: KeyColor | null;
  /** Only meaningful when doorColor is set. Starts false; runtime flips it true
   * permanently once the matching key touches it — never authored true in the editor. */
  doorOpen: boolean;
}

export interface EnemyPlacement {
  enemyId: string;
  x: number;
  y: number;
  facing: number;
}

export interface KeyPickup {
  color: KeyColor;
  x: number;
  y: number;
}

export interface MapData {
  schemaVersion: typeof SCHEMA_VERSION;
  id: string;
  name: string;
  width: number;
  height: number;
  cells: Cell[];
  enemyDefs: EnemyDef[];
  enemies: EnemyPlacement[];
  textures: TextureDef[];
  songs: Song[];
  audioTracks: AudioTrackDef[];
  music: MapMusicSettings;
  intro: IntroOutroConfig;
  outro: IntroOutroConfig;
  sfx: SfxDef[];
  weapons: WeaponDef[];
  weaponPickups: WeaponPickup[];
  keyPickups: KeyPickup[];
  player: PlayerDef;
  playerStart: { x: number; y: number; facing: number };
  exit: { x: number; y: number };
}
